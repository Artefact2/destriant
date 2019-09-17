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

const dst_reset_tx_modal = function(modal) {
	modal.find('.modal-title').text('Input transaction');
	modal.find("button#tx-editor-modal-save").prop('disabled', false);
	modal.find('form')[0].reset();
	modal.find('select#tx-editor-type').change();
	modal.find('input#tx-editor-date').val(new Date().toISOString().split('T')[0]);
	modal.data('id', -1);

	let sa = modal.find('select#tx-editor-account').prop('disabled', true).empty();
	let ss = modal.find('select#tx-editor-security').prop('disabled', true).empty();

	dst_get_state('accounts').then(accounts => {
		if(accounts === null) accounts = [];
		accounts.forEach(a => sa.append($(document.createElement('option')).prop('value', a.id).text(a.name).data('currency', a.currency)));
		sa.prop('disabled', false);
		sa.change();
	});

	dst_get_state('securities').then(securities => {
		if(securities === null) securities = {};
		Object.values(securities).forEach(s => ss.append($(document.createElement('option')).prop('value', s.ticker).text(
			s.ticker + ', ' + s.name
		).data('currency', s.currency)));
		ss.prop('disabled', false);
		ss.change();
	});
};

const dst_fetch_and_reload_tx_list = function() {
	let tbody = $("div#tx-editor tbody");
	tbody.empty();
	tbody.append($(document.createElement('tr')).append(
		$(document.createElement('td')).prop('colspan', 10).text('Loading transaction list…')
	));

	dst_get_state('transactions').then(dst_reload_tx_list);
};

const dst_reload_tx_list = function(txs) {
	let tbody = $("div#tx-editor tbody");
	if(txs === null) txs = [];
	tbody.empty();

	if(txs.length === 0) {
		tbody.append($(document.createElement('tr')).append(
			$(document.createElement('td')).prop('colspan', 10).text('Transaction list is empty.')
		));
		return;
	}

	dst_get_states([ 'securities', 'accounts' ]).then(state => {
		let accountmap = {};
		state.accounts.forEach(a => accountmap[a.id] = a);

		txs.forEach((tx, idx) => {
			let tr = $(document.createElement('tr'));
			tr.data('idx', idx);
			tr.append($(document.createElement('td')).text(idx));
			tr.append($(document.createElement('td')).text(tx.date));
			tr.append($(document.createElement('td')).text(tx.type));

			switch(tx.type) {
			case 'split':
				tr.append($(document.createElement('td')));
				tr.append($(document.createElement('td')).text(tx.ticker));
				tr.append($(document.createElement('td')).text(
					tx.before.toString() + ':' + tx.after.toString()
				).prop('colspan', 4));
				break;

			case 'cash':
				tr.append($(document.createElement('td')).text(accountmap[tx.account].name));
				tr.append($(document.createElement('td')));
				tr.append($(document.createElement('td')).text(tx.quantity.toString()).prop('colspan', 2));
				tr.append($(document.createElement('td')).append(dst_format_currency_amount(accountmap[tx.account].currency, tx.fee)));
				tr.append($(document.createElement('td')).append(dst_format_currency_amount(accountmap[tx.account].currency, tx.total)));
				break;

			case 'security':
				tr.append($(document.createElement('td')).text(accountmap[tx.account].name));
				tr.append($(document.createElement('td')).text(tx.ticker));
				tr.append($(document.createElement('td')).text(tx.quantity.toString()));
				tr.append($(document.createElement('td')).append(dst_format_currency_amount(state.securities[tx.ticker].currency, tx.price)));
				tr.append($(document.createElement('td')).append(dst_format_currency_amount(accountmap[tx.account].currency, tx.fee)));
				tr.append($(document.createElement('td')).append(dst_format_currency_amount(accountmap[tx.account].currency, tx.total)));
				break;
			}

			tr.append($(document.createElement('td')).append(
				$(document.createElement('button')).addClass('btn btn-sm btn-secondary edit-tx').text('Edit').prop('disabled', true),
				' ',
				$(document.createElement('button')).addClass('btn btn-sm btn-secondary delete-tx').text('Delete')
			));
			tbody.prepend(tr);
		});
	});
};

$(function() {
	$("button#tx-editor-new-tx").click(function() {
		let modal = $("div#tx-editor-modal");
		dst_reset_tx_modal(modal);
		modal.modal('show');
	});
	$("button#tx-editor-modal-cancel").click(function() {
		$("div#tx-editor-modal").modal('hide');
	});

	$("select#tx-editor-type").change(function() {
		let s = $(this);
		s.closest('form').find('.maybe-hide').hide();
		s.closest('form').find('.maybe-hide.show-' + s.val()).show();
		s.closest('form').find('.maybe-disable').prop('disabled', true);
		s.closest('form').find('.maybe-disable.enable-' + s.val()).prop('disabled', false);
	});
	$("select#tx-editor-account").change(function() {
		let ccy = $(this).children('option:selected').data('currency');
		$("div#tx-editor-total-currency, div#tx-editor-fee-currency, div#tx-editor-amount-currency").text(ccy);
	});
	$("select#tx-editor-security").change(function() {
		let ccy = $(this).children('option:selected').data('currency');
		$("div#tx-editor-price-currency").text(ccy);
	});

	$("div#tx-editor-modal form").submit(function() {
		let modal = $("div#tx-editor-modal");
		let type = modal.find('select#tx-editor-type').val();
		let tx = {
			date: modal.find('input#tx-editor-date').val(),
		};

		if(type !== 'split') {
			tx.account = modal.find('select#tx-editor-account').val();
			tx.fee = parseFloat(modal.find('input#tx-editor-fee').val());
			tx.total = parseFloat(modal.find('input#tx-editor-total').val());
		}

		if(type === 'cash' || type === 'cgain') {
			tx.type = 'cash';
		} else if(type === 'split') {
			tx.type = 'split';
			tx.before = parseFloat(modal.find('input#tx-editor-split-before').val());
			tx.after = parseFloat(modal.find('input#tx-editor-split-after').val());
		} else {
			tx.type = 'security';
			tx.ticker = modal.find('select#tx-editor-security').val();
		}

		switch(type) {
		case 'cash':
			tx.quantity = parseFloat(modal.find('input#tx-editor-amount').val());
			break;

		case 'cgain':
			tx.quantity = parseFloat(modal.find('input#tx-editor-amount').val());
			break;

		case 'sdividend':
			tx.quantity = parseFloat(modal.find('input#tx-editor-quantity').val());
			tx.price = 0;
			break;

		case 'cdividend':
			tx.price = 1.00;
			tx.quantity = parseFloat(modal.find('input#tx-editor-amount').val());
			break;

		case 'security':
			tx.quantity = parseFloat(modal.find('input#tx-editor-quantity').val());
			tx.price = parseFloat(modal.find('input#tx-editor-price').val());
			break;
		}

		if(tx.type === 'cash') {
			if(isNaN(tx.total)) {
				tx.total = tx.quantity - tx.fee;
			} else if(isNaN(tx.quantity)) {
				tx.quantity = tx.total + tx.fee;
			} else if(isNaN(tx.fee)) {
				tx.fee = tx.quantity - tx.total;
			}

			if(isNaN(tx.fee) || isNaN(tx.total) || isNaN(tx.quantity)) {
				modal.find('input#tx-editor-fee, input#tx-editor-total, input#tx-editor-amount').addClass('is-invalid');
				/* XXX: show some kind of error message */
				return;
			}
			if(Math.abs(tx.total + tx.fee - tx.quantity) >= 1e-6) {
				modal.find('input#tx-editor-fee, input#tx-editor-total, input#tx-editor-amount').addClass('is-invalid');
				/* XXX: show some kind of error message */
				return;
			}

			if(type === "cgain") {
				tx.fee -= tx.quantity;
				tx.quantity = 0.0;
			}
		} else if(tx.type === 'security') {
			/* XXX: flip total if buying and total > 0 */

			if(isNaN(tx.total)) {
				tx.total = -tx.quantity * tx.price - tx.fee;
			} else if(isNaN(tx.fee)) {
				tx.fee = -tx.quantity * tx.price - tx.total;
			} else if(isNaN(tx.quantity)) {
				tx.quantity = (-tx.total - tx.fee) / tx.price;
			} else if(isNaN(tx.price)) {
				tx.price = (-tx.total - tx.fee) / tx.quantity;
			}

			if(isNaN(tx.total) || isNaN(tx.fee) || isNaN(tx.quantity) || isNaN(tx.price)) {
				modal.find('input#tx-editor-fee, input#tx-editor-total, input#tx-editor-quantity, input#tx-editor-price').addClass('is-invalid');
				/* XXX: show some kind of error message */
				return;
			}

			if(Math.abs(tx.total + tx.quantity * tx.price + tx.fee) >= 1e-6) {
				modal.find('input#tx-editor-fee, input#tx-editor-total, input#tx-editor-quantity, input#tx-editor-price').addClass('is-invalid');
				/* XXX: show some kind of error message */
				return;
			}

			if(type === "cdividend") {
				tx.fee -= tx.quantity;
				tx.price = 0.0;
				tx.quantity = 0.0;
			}
		} else {
			console.assert(tx.type === 'split');
			if(isNaN(tx.before) || isNaN(tx.after) || !tx.before || !tx.after) {
				modal.find('input#tx-editor-split-before, input#tx-editor-split-after').addClass('is-invalid');
				/* XXX */
				return;
			}
		}

		modal.find('button#tx-editor-modal-save').prop('disabled', true);
		dst_get_state('transactions').then(txs => {
			if(txs === null) txs = [];

			/* XXX: inefficient, use a binary search */
			let i, imax = txs.length;
			for(i = 0; i < imax && txs[i].date <= tx.date; ++i) { }
			txs.splice(i, 0, tx);

			dst_set_state('transactions', txs).then(function() {
				dst_reload_tx_list(txs);
				modal.modal('hide');
			});
		});
	});

	$("div#tx-editor").on('click', 'button.delete-tx', function() {
		$(this).prop('disabled', true);
		let tr = $(this).closest('tr');

		dst_get_state('transactions').then(txs => {
			txs.splice(tr.data('idx'), 1);
			dst_set_state('transactions', txs).then(function() {
				tr.fadeOut(200, function() {
					dst_reload_tx_list(txs);
				});
			});
		});
	});

	dst_fetch_and_reload_tx_list();
});