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
	modal.find('select').change();
	modal.find('input#tx-editor-date').val(new Date().toISOString().split('T')[0]);
	modal.find('.is-invalid').removeClass('is-invalid');
	modal.data('id', -1);
};

const dst_smart_autofill_tx_modal = function(modal, transactions) {
	/* Auto-fill some fields based on last visible tx */
	const id = $("div#tx-editor tbody tr:first-child").data('id');
	if(!(id in transactions)) return;
	const tx = transactions[id];
	modal.find("select#tx-editor-account").val(tx.account).change();
	modal.find("select#tx-editor-type").val(tx.type).change();
	if(tx.type === "security") {
		modal.find("select#tx-editor-security").val(tx.ticker).change();
	}
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

	dst_get_states([ 'securities', 'accounts' ]).then(state => {
		let accountmap = {};
		state.accounts.forEach(a => accountmap[a.id] = a);

		let faccount = $("select#tx-editor-filter-account").val();
		if(faccount !== null && faccount !== "__all__") faccount = parseInt(faccount, 10);

		let fsecurity = $("select#tx-editor-filter-security").val();
		let fbefore = $("input#tx-editor-filter-before").val();
		let fafter = $("input#tx-editor-filter-after").val();

		txs.forEach(tx => {
			if(faccount !== null && faccount !== "__all__" && tx.account !== faccount) return;
			if(fsecurity !== null && fsecurity !== "__all__") {
				if(fsecurity === "__cash__" && tx.type !== 'cash') return;
				if(fsecurity === "__split__" && tx.type !== 'split') return;
				if(fsecurity === "__sec__" && tx.type !== 'security') return;
				if(fsecurity !== "__sec__" && fsecurity !== "__cash__" && fsecurity !== "__split__" && fsecurity !== tx.ticker) return;
			}
			if(fbefore !== "" && fbefore < tx.date) return;
			if(fafter !== "" && fafter > tx.date) return;

			tbody.prepend(dst_make_tx_tr(tx, accountmap[tx.account], state.securities[tx.ticker]));
		});

		if(tbody.children().length === 0) {
			tbody.append($(document.createElement('tr')).addClass('placeholder').append(
				$(document.createElement('td')).prop('colspan', 10).text('Transaction list is empty or all filtered out.')
			));
			return;
		}
	});
};

const dst_make_tx_tr = function(tx, account, security) {
	let tr = $(document.createElement('tr'));
	tr.data('id', tx.id);
	tr.append($(document.createElement('td')).text(tx.id));
	tr.append($(document.createElement('td')).text(tx.date));
	tr.append($(document.createElement('td')).text(tx.type));

	switch(tx.type) {
	case 'split':
		tr.append($(document.createElement('td')));
		tr.append($(document.createElement('td')).append($(document.createElement('strong')).text(tx.ticker)));
		tr.append($(document.createElement('td')).text(
			tx.before.toString() + ':' + tx.after.toString()
		).addClass('text-right'));
		tr.append($(document.createElement('td')).prop('colspan', 3));
		break;

	case 'cash':
		tr.append($(document.createElement('td')).append($(document.createElement('strong')).text(account.name)));
		tr.append($(document.createElement('td')).append(dst_format_fixed_amount(tx.quantity, 4)).addClass('text-right').prop('colspan', 2));
		tr.append($(document.createElement('td')));
		tr.append($(document.createElement('td')).append(dst_format_currency_amount(account.currency, tx.fee)).addClass('text-right'));
		tr.append($(document.createElement('td')).append(dst_format_currency_amount(account.currency, tx.quantity - tx.fee)).addClass('text-right'));
		break;

	case 'security':
		tr.append($(document.createElement('td')).append($(document.createElement('strong')).text(account.name)));
		tr.append($(document.createElement('td')).append($(document.createElement('strong')).text(tx.ticker)));
		tr.append($(document.createElement('td')).append(dst_format_fixed_amount(tx.quantity, 4)).addClass('text-right'));
		tr.append($(document.createElement('td')).append(dst_format_currency_amount(security.currency, tx.price)).addClass('text-right'));
		tr.append($(document.createElement('td')).append(dst_format_currency_amount(account.currency, tx.fee)).addClass('text-right'));
		tr.append($(document.createElement('td')).append(dst_format_currency_amount(account.currency, -tx.quantity * tx.price - tx.fee)).addClass('text-right'));
		break;
	}

	tr.append($(document.createElement('td')).append(
		$(document.createElement('button')).addClass('btn btn-xs btn-secondary edit-tx').text('Edit'),
		' ',
		$(document.createElement('button')).addClass('btn btn-xs btn-secondary delete-tx').text('Delete')
	).addClass('text-right'));
	return tr;
};

dst_on_load(function() {
	$("button#tx-editor-new-tx").click(() => dst_get_state('transactions').then(txs => {
		let modal = $("div#tx-editor-modal");
		dst_reset_tx_modal(modal);
		dst_smart_autofill_tx_modal(modal, txs);
		modal.modal('show');
	}));
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
		let ccy = $(this).children(':selected').data('currency');
		$("div#tx-editor-total-currency, div#tx-editor-fee-currency, div#tx-editor-amount-currency").text(ccy);
	});
	$("select#tx-editor-security").change(function() {
		let ccy = $(this).children(':selected').data('currency');
		$("div#tx-editor-price-currency").text(ccy);
	});

	$("div#tx-editor-modal form").submit(function(e) {
		e.preventDefault();
		let modal = $("div#tx-editor-modal");
		let type = modal.find('select#tx-editor-type').val();
		let total = NaN;
		let tx = {
			date: modal.find('input#tx-editor-date').val(),
		};

		if(type !== 'split') {
			tx.account = parseInt(modal.find('select#tx-editor-account').val(), 10);
			tx.fee = parseFloat(modal.find('input#tx-editor-fee').val());
			total = parseFloat(modal.find('input#tx-editor-total').val());
		}

		if(type === 'cash' || type === 'cgain') {
			tx.type = 'cash';
		} else if(type === 'split') {
			tx.type = 'split';
			tx.before = parseFloat(modal.find('input#tx-editor-split-before').val());
			tx.after = parseFloat(modal.find('input#tx-editor-split-after').val());
			tx.ticker = modal.find('select#tx-editor-security').val();
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
			tx.quantity = -parseFloat(modal.find('input#tx-editor-amount').val());
			break;

		case 'security':
			tx.quantity = parseFloat(modal.find('input#tx-editor-quantity').val());
			tx.price = parseFloat(modal.find('input#tx-editor-price').val());
			break;
		}

		if(tx.type === 'cash') {
			if(isNaN(total)) {
				total = tx.quantity - tx.fee;
			} else if(isNaN(tx.quantity)) {
				tx.quantity = total + tx.fee;
			} else if(isNaN(tx.fee)) {
				tx.fee = tx.quantity - total;
			}

			if(isNaN(tx.fee) || isNaN(total) || isNaN(tx.quantity)) {
				modal.find('input#tx-editor-fee, input#tx-editor-total, input#tx-editor-amount').addClass('is-invalid');
				/* XXX: show some kind of error message */
				return;
			}
			if(Math.abs(total + tx.fee - tx.quantity) >= 1e-6) {
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

			if(isNaN(total)) {
				total = -tx.quantity * tx.price - tx.fee;
			} else if(isNaN(tx.fee)) {
				tx.fee = -tx.quantity * tx.price - total;
			} else if(isNaN(tx.quantity)) {
				tx.quantity = (-total - tx.fee) / tx.price;
			} else if(isNaN(tx.price)) {
				tx.price = (-total - tx.fee) / tx.quantity;
			}

			if(isNaN(total) || isNaN(tx.fee) || isNaN(tx.quantity) || isNaN(tx.price)) {
				modal.find('input#tx-editor-fee, input#tx-editor-total, input#tx-editor-quantity, input#tx-editor-price').addClass('is-invalid');
				/* XXX: show some kind of error message */
				return;
			}

			if(Math.abs(total + tx.quantity * tx.price + tx.fee) >= 1e-6) {
				modal.find('input#tx-editor-fee, input#tx-editor-total, input#tx-editor-quantity, input#tx-editor-price').addClass('is-invalid');
				/* XXX: show some kind of error message */
				return;
			}

			if(type === "cdividend") {
				tx.fee += tx.quantity;
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
		dst_get_states([ 'transactions', 'accounts', 'securities' ]).then(state => {
			if(state.transactions === null) state.transactions = [];
			let tbody = $("div#tx-editor tbody");

			if(modal.data('id') > -1) {
				/* Don't update in place, tx date may have changed, delete and reinsert to keep the tx list sorted */
				let idx = state.transactions.findIndex(t => t.id === modal.data('id'));
				state.transactions.splice(idx, 1);
				tbody.children().filter((_, tr) => $(tr).data('id') === modal.data('id')).remove();
				tx.id = modal.data('id');
			} else {
				tx.id = state.transactions.reduce((m, tx) => Math.max(m, tx.id), 0) + 1;
			}

			/* XXX: transaction may be filtered out */
			/* XXX: inefficient, use a binary search */
			let i, imax = state.transactions.length;
			for(i = 0; i < imax && state.transactions[i].date <= tx.date; ++i) { }
			state.transactions.splice(i, 0, tx);

			dst_set_state('transactions', state.transactions).then(function() {
				let tr = dst_make_tx_tr(tx, state.accounts.find(a => a.id === tx.account), state.securities[tx.ticker]);
				if(i === imax) {
					tbody.prepend(tr);
				} else {
					tbody.children().filter((_, tr) => $(tr).data('id') === state.transactions[i+1].id).after(tr);
				}
				tbody.children('tr.placeholder').remove();
				modal.modal('hide');
				dst_trigger_state_change('txs', state.transactions);
			});
		});
	});

	$("div#tx-editor").on('click', 'button.delete-tx', function() {
		let tr = $(this).closest('tr');
		if(!confirm('Really delete transaction #' + tr.data('id') + '?')) {
			return;
		}
		$(this).prop('disabled', true);

		dst_get_state('transactions').then(txs => {
			txs.splice(txs.findIndex(tx => tx.id === tr.data('id')), 1);
			dst_set_state('transactions', txs).then(function() {
				tr.fadeOut(200, () => tr.remove());
				dst_trigger_state_change('txs', txs);
			});
		});
	}).on('click', 'button.edit-tx', function() {
		let tr = $(this).closest('tr');
		let modal = $("div#tx-editor-modal");

		dst_get_state('transactions').then(txs => {
			let tx = txs.find(tx => tx.id === tr.data('id'));

			dst_reset_tx_modal(modal);
			modal.find('.modal-title').text('Edit transaction');
			modal.find('input#tx-editor-date').val(tx.date);

			if(tx.type === 'split') {
				modal.find('select#tx-editor-type').val('split').change();
				modal.find('select#tx-editor-security').val(tx.ticker).change();
				modal.find('input#tx-editor-split-before').val(tx.before);
				modal.find('input#tx-editor-split-after').val(tx.after);
			} else if(tx.type === 'cash') {
				modal.find('select#tx-editor-type').val('cash').change();
				modal.find('select#tx-editor-account').val(tx.account).change();
				modal.find('input#tx-editor-amount').val(tx.quantity);
				modal.find('input#tx-editor-fee').val(tx.fee);
				modal.find('input#tx-editor-total').val(tx.quantity - tx.fee);
			} else if(tx.type === 'security') {
				modal.find('select#tx-editor-type').val('security').change();
				modal.find('select#tx-editor-account').val(tx.account).change();
				modal.find('select#tx-editor-security').val(tx.ticker).change();
				modal.find('input#tx-editor-quantity').val(tx.quantity);
				modal.find('input#tx-editor-price').val(tx.price);
				modal.find('input#tx-editor-fee').val(tx.fee);
				modal.find('input#tx-editor-total').val(-tx.quantity * tx.price - tx.fee);
			}

			modal.data('id', tr.data('id')).modal('show');
		});
	});

	$("div#pf table").on('click', 'button.input-transaction', function() {
		let tr = $(this).closest('tr');
		let modal = $("div#tx-editor-modal");
		let account = parseInt($("select#main-account-selector").val(), 10);
		dst_reset_tx_modal(modal);
		modal.find('select#tx-editor-security').val(tr.data('ticker')).change();
		if(account === -1) account = tr.data('account');
		modal.find('select#tx-editor-account').val(account).change();
		modal.modal('show');
	});

	$("input#tx-editor-filter-before").val(new Date().toISOString().split('T')[0]);
	$("input#tx-editor-filter-after").val(new Date(Date.now() - 750 * 86400000).toISOString().split('T')[0]);
	$("form#tx-editor-filter").submit(e => {
		e.preventDefault();
		dst_mark_stale($("div#tx-editor"));
	});

	dst_on_state_change('securities', securities => dst_fill_security_select($("select#tx-editor-security, select#tx-editor-filter-security"), securities));
	dst_on_state_change('accounts', accounts => {
		dst_fill_account_select($("select#tx-editor-account, select#tx-editor-filter-account"), accounts);
		dst_mark_stale($("div#tx-editor"));
	});

	$("div#tx-editor").on('dst-load', dst_fetch_and_reload_tx_list);
});
