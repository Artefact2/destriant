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

const dst_reset_securities_modal = function(modal) {
	modal.find('.modal-title').text('New security');
	modal.find('.is-invalid').removeClass('is-invalid');
	modal.find('.invalid-feedback').remove();
	modal.find('input#security-editor-ticker').prop('disabled', false);
	modal.find('button#security-editor-modal-save').prop('disabled', false);
	modal.find('form')[0].reset();
	modal.find('input#security-editor-is-index').change();
	modal.data('ticker', null);
};

const dst_fetch_and_reload_securities_list = function() {
	let tbody = $("div#security-editor tbody");
	tbody.empty();
	tbody.append($(document.createElement('tr')).append(
		$(document.createElement('td')).attr('colspan', 6).text('Loading securities list…')
	));

	return dst_get_state('securities').then(dst_reload_securities_list);
};

const dst_reload_securities_list = function(securities) {
	if(securities === null) securities = {};

	let tbody = $("div#security-editor tbody");
	tbody.empty();

	if($.isEmptyObject(securities)) {
		tbody.append($(document.createElement('tr')).append(
			$(document.createElement('td')).attr('colspan', 6).text('Securities list is empty.')
		));
		return;
	}

	for(let t in securities) {
		let s = securities[t];
		console.assert(t === s.ticker);
		let tr = $(document.createElement('tr'));

		tr.append($(document.createElement('td')).append($(document.createElement('strong')).text(s.ticker)));
		tr.append($(document.createElement('td')).append($(document.createElement('strong')).text(s.name)));
		tr.append($(document.createElement('td')).text(s.isin));
		tr.append($(document.createElement('td')).text(s.exchange));
		tr.append($(document.createElement('td')).text(s.currency));
		tr.append($(document.createElement('td')).append(
			$(document.createElement('button')).addClass('btn btn-sm btn-secondary edit-security').text('Edit'),
			' ',
			$(document.createElement('button')).addClass('btn btn-sm btn-secondary delete-security').text('Delete')
		).addClass('text-right'));

		tr.data('ticker', s.ticker);
		tbody.append(tr);
	}
};

const dst_fill_security_select = function(select, securities) {
	let work = (select, securities) => {
		if(securities === null) securities = {};
		select.children('option.auto').remove();
		Object.values(securities).forEach(s => select.append($(document.createElement('option')).addClass('auto').prop('value', s.ticker).text(
			s.ticker + ', ' + s.name
		).data('currency', s.currency)));
	};

	if(typeof securities === 'undefined') {
		return dst_get_state('securities').then(securities => work(select, securities));
	} else {
		return new Promise((resolve, reject) => resolve(work(select, securities)));
	}
};

dst_on_load(function() {
	$("button#security-editor-new-security").click(function() {
		let modal = $("div#security-editor-modal");
		dst_reset_securities_modal(modal);
		modal.modal('show');
	});

	$("div#security-editor-modal button#security-editor-modal-cancel").click(function() {
		$("div#security-editor-modal").modal('hide');
	});
	$("div#security-editor-modal form").submit(function(e) {
		e.preventDefault();
		let modal = $("div#security-editor-modal");
		let btn = modal.find("button#security-editor-modal-save");

		let security = {
			ticker: modal.find('input#security-editor-ticker').val(),
			name: modal.find('input#security-editor-name').val(),
			isin: modal.find('input#security-editor-isin').val(),
			currency: modal.find('select#security-editor-ccy').val(),
			exchange: modal.find('select#security-editor-exchange').val(),
		};

		if($("input#security-editor-is-index").is(':checked')) {
			security.index = $("select#security-editor-index").val();
		}

		for(let eid of [
			[ 'type', 'security-editor-exp-asset-class' ],
			[ 'currency', 'security-editor-exp-currency' ],
			[ 'country', 'security-editor-exp-country' ],
			[ 'gics', 'security-editor-exp-gics' ],
		]) {
			let input = $("input#" + eid[1]), exp;
			if('index' in security || input.val().length === 0) continue;
			try {
				exp = JSON.parse(input.val());
				if(typeof exp !== "object") throw 0;
				for(let k in exp) {
					if(typeof exp[k] !== "number") throw 1;
				}
			} catch(e) {
				exp = {};
				exp[input.val()] = 1.0;
			} finally {
				if(!($.isEmptyObject(exp))) {
					if(!("exposures" in security)) {
						security.exposures = {};
					}
					security.exposures[eid[0]] = exp;
				}
			}
		}

		btn.prop('disabled', true);
		dst_get_state('securities').then(function(secs) {
			if(secs === null) secs = {};

			if(modal.data('ticker') !== null) {
				/* Updating a security */
				console.assert(security.ticker === modal.data('ticker'));
				secs[security.ticker] = security;
			} else if(security.ticker in secs) {
				/* Creating security, ticker already used */
				modal.find('.is-invalid').removeClass('is-invalid');
				modal.find('.invalid-feedback').remove();
				modal.find('input#security-editor-ticker').addClass('is-invalid').after(
					$(document.createElement('div'))
						.addClass('invalid-feedback')
						.text('Ticker already used by another security')
				);
				btn.prop('disabled', false);
				return;
			} else {
				secs[security.ticker] = security;
			}

			dst_set_state('securities', secs).then(function() {
				dst_reload_securities_list(secs); /* XXX: edit/insert in place */
				dst_trigger_state_change('securities', secs);
				modal.modal('hide');
			});
		});
	});

	$("div#security-editor table").on('click', 'button.edit-security', function() {
		let tr = $(this).closest('tr');
		let modal = $("div#security-editor-modal");

		dst_get_state('securities').then(function(secs) {
			let s = secs[tr.data('ticker')];

			dst_reset_securities_modal(modal);
			modal.find('.modal-title').text('Edit security');
			modal.find('input#security-editor-ticker').val(s.ticker).prop('disabled', true);
			modal.find('input#security-editor-name').val(s.name);
			modal.find('input#security-editor-isin').val(s.isin);
			modal.find('select#security-editor-ccy').val(s.currency);
			modal.find('select#security-editor-exchange').val(s.exchange);

			modal.find('input#security-editor-is-index').prop('checked', 'index' in s).change();
			if('index' in s) modal.find('select#security-editor-index').val(s.index);
			if('exposures' in s) {
				if('type' in s.exposures) modal.find('input#security-editor-exp-asset-class').val(JSON.stringify(s.exposures.type));
				if('currency' in s.exposures) modal.find('input#security-editor-exp-currency').val(JSON.stringify(s.exposures.currency));
				if('country' in s.exposures) modal.find('input#security-editor-exp-country').val(JSON.stringify(s.exposures.country));
				if('gics' in s.exposures) modal.find('input#security-editor-exp-gics').val(JSON.stringify(s.exposures.gics));
			}

			modal.data('ticker', s.ticker).modal('show');
		});
	}).on('click', 'button.delete-security', function() {
		let btn = $(this).prop('disabled', true);
		let tr = btn.closest('tr');

		dst_get_states([ 'securities', 'transactions', 'prices' ]).then(state => {
			if(state.transactions === null) state.transactions = [];

			/* XXX: ask if it's okay to delete those transactions */
			if(state.transactions.some(tx => tx.ticker === tr.data('ticker'))) {
				alert('Some transactions are still tied to this security; cannot continue.');
				btn.prop('disabled', false);
				return;
			}

			/* XXX: ask for deletion */
			if(tr.data('ticker') in state.prices) {
				alert('Some prices are still tied to this security; cannot continue.');
				btn.prop('disabled', false);
				return;
			}

			/* XXX: use something prettier */
			if(!confirm('Really delete security: ' + tr.data('ticker') + '?')) {
				btn.prop('disabled', false);
				return;
			}

			delete state.securities[tr.data('ticker')];
			dst_set_state('securities', state.securities).then(function() {
				tr.fadeOut(200, function() {
					if($.isEmptyObject(state.securities)) {
						dst_reload_securities_list(state.securities);
					}
					dst_trigger_state_change('securities', state.securities);
				});
			});
		});
	});

	dst_fill_currency_select($("select#security-editor-ccy"));
	dst_fill_exchange_select($("select#security-editor-exchange"));
	dst_on_state_change('ext', ext => {
		let select = $("select#security-editor-index").empty();
		if(ext === null || !("exposures" in ext)) return;
		for(let k in ext.exposures) {
			select.append($(document.createElement('option')).prop('value', k).text(k));
		}
	});

	$("input#security-editor-is-index").change(function() {
		let checked = this.checked;
		let form = $(this).closest('form');
		if(checked) {
			form.find('.index-hide').hide();
			form.find('.index-show').show();
		} else {
			form.find('.index-hide').show();
			form.find('.index-show').hide();
		}
	});

	$("div#security-editor").on('dst-load', dst_fetch_and_reload_securities_list);
});
