/* Copyright 2019 Romain "Artefact2" Dal Maso <romain.dalmaso@artefact2.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

const dst_fetch_and_reload_account_list = function() {
	let tbody = $("div#acct-editor tbody");
	tbody.empty();
	tbody.append($(document.createElement('tr')).append(
		$(document.createElement('td')).attr('colspan', 5).text('Loading account list…')
	));

	return dst_get_state('accounts').then(dst_reload_account_list);
};

const dst_reload_account_list = function(accounts) {
	let tbody = $("div#acct-editor tbody");
	if(accounts === null) accounts = [];
	tbody.empty();

	for(let k in accounts) {
		let a = accounts[k];
		let tr = $(document.createElement('tr'));
		tr.data('idx', k);
		tr.append($(document.createElement('td')).text(a.id));
		tr.append($(document.createElement('td')).append($(document.createElement('strong')).text(a.name)));
		tr.append($(document.createElement('td')).text(a.currency));
		tr.append($(document.createElement('td')).append(
			dst_format_currency_amount(a.currency, a.fees[0]),
			' + ' + a.fees[1].toFixed(2) + '% + ',
			dst_format_currency_amount(a.currency, a.fees[2]),
			'/share'
		));
		tr.append($(document.createElement('td')).append(
			$(document.createElement('button')).addClass('btn btn-xs btn-secondary edit-account').text('Edit'),
			' ',
			$(document.createElement('button')).addClass('btn btn-xs btn-secondary delete-account').text('Delete')
		).addClass('text-right'));
		tbody.append(tr);
	}

	if(accounts.length > 0) return;

	tbody.append($(document.createElement('tr')).append(
		$(document.createElement('td')).attr('colspan', 5).text('Account list is empty.')
	));
};

const dst_reset_acct_modal = function(modal) {
	modal.find(".modal-title").text('Create account');
	modal.find("button#acct-editor-modal-save").prop('disabled', false);
	modal.find("form")[0].reset();
	modal.find("select#acct-editor-acct-ccy").change();
	modal.data('idx', -1);
};

const dst_fill_account_select = function(select, accounts) {
	let fill = (select, accounts) => {
		if(accounts === null) accounts = [];
		select.children('option.auto').remove();
		accounts.forEach(a => select.append(
			$(document.createElement('option')).addClass('auto').prop('value', a.id).text(a.name).data('currency', a.currency)
		));
	};

	if(typeof accounts === 'undefined') {
		return dst_get_state('accounts').then(accounts => fill(select, accounts));
	} else {
		return new Promise((resolve, reject) => resolve(fill(select, accounts)));
	}
};

dst_on_load(function() {
	$("button#acct-editor-new-acct").click(function() {
		let modal = $("div#acct-editor-modal");
		dst_reset_acct_modal(modal);
		modal.modal('show');
	});

	$("div#acct-editor").on('click', 'button.edit-account', function() {
		let tr = $(this).closest('tr');
		let modal = $("div#acct-editor-modal");

		dst_get_state('accounts').then(function(accounts) {
			let a = accounts[tr.data('idx')];

			dst_reset_acct_modal(modal);
			modal.find(".modal-title").text('Edit account #' + tr.data('idx'));
			modal.find('input#acct-editor-acct-name').val(a.name);
			modal.find('select#acct-editor-acct-ccy').val(a.currency).change();
			modal.find('input#acct-editor-fee-flat').val(a.fees[0]);
			modal.find('input#acct-editor-fee-percent').val(a.fees[1]);
			modal.find('input#acct-editor-fee-pershare').val(a.fees[2]);
			modal.data('idx', tr.data('idx')).modal('show');
		});

	}).on('click', 'button.delete-account', function() {
		let btn = $(this).prop('disabled', true);
		let tr = $(this).closest('tr');

		dst_get_states([ 'accounts', 'transactions' ]).then(state => {
			if(state.transactions === null) state.transactions = [];
			let accountid = state.accounts[tr.data('idx')].id;

			if(state.transactions.some(tx => tx.account === accountid)) {
				/* XXX: ask if it's ok to delete those transactions */
				alert('Some transactions are still tied to this account; cannot continue.');
				btn.prop('disabled', false);
				return;
			}

			if(!confirm('Really delete account: ' + state.accounts[tr.data('idx')].name + '?')) {
				/* XXX: use something prettier */
				btn.prop('disabled', false);
				return;

			}

			state.accounts.splice(tr.data('idx'), 1);
			dst_set_state('accounts', state.accounts).then(function() {
				tr.fadeOut(200, function() {
					dst_trigger_state_change('accounts', state.accounts);
					dst_reload_account_list(state.accounts); /* XXX: delete in place */
				});
			});
		});
	});

	$("div#acct-editor-modal button#acct-editor-modal-cancel").click(function() {
		$("div#acct-editor-modal").modal('hide');
	});
	$("div#acct-editor-modal form").submit(function(e) {
		e.preventDefault();

		let modal = $("div#acct-editor-modal");
		let btn = modal.find("button#acct-editor-modal-save");

		let account = {
			id: null,
			name: modal.find('input#acct-editor-acct-name').val(),
			currency: modal.find('select#acct-editor-acct-ccy').val(),
			fees: [
				parseFloat(modal.find('input#acct-editor-fee-flat').val()),
				parseFloat(modal.find('input#acct-editor-fee-percent').val()),
				parseFloat(modal.find('input#acct-editor-fee-pershare').val()),
			],
		};

		for(let i = 0; i < 3; ++i) {
			if(isNaN(account.fees[i])) {
				account.fees[i] = 0.0;
			}
		}

		btn.prop('disabled', true);

		dst_get_state('accounts').then(function(accounts) {
			if(accounts === null || accounts.length === 0) {
				accounts = [];
				account.id = 0;
			} else {
				account.id = accounts[accounts.length - 1].id + 1;
			}

			if(modal.data('idx') >= 0) {
				account.id = accounts[modal.data('idx')].id;
				accounts[modal.data('idx')] = account;
			} else {
				accounts.push(account);
			}

			dst_set_state('accounts', accounts).then(function() {
				dst_reload_account_list(accounts); /* XXX: update/insert in place */
				dst_trigger_state_change('accounts', accounts);
				modal.modal('hide');
			});
		});
	});
	$("select#acct-editor-acct-ccy").change(function() {
		$(this).closest('form').find('.acct-editor-fee-currency').text($(this).val());
	});

	dst_fill_currency_select($("select#acct-editor-acct-ccy"));

	$("div#acct-editor").on('dst-load', dst_fetch_and_reload_account_list);
});
