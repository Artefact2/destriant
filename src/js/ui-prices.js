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

const dst_reset_price_modal = modal => {
	modal.find('.modal-title').text('Input security price');
	modal.find("button#price-editor-modal-save").prop('disabled', false);
	modal.find('form')[0].reset();
	modal.find('select').change();
	modal.find('input#price-editor-date').val(new Date().toISOString().split('T')[0]);
};

const dst_fetch_and_reload_price_table = () => {
	let tbody = $("div#price-editor tbody");
	tbody.empty();
	tbody.append($(document.createElement('tr')).append($(document.createElement('td')).prop('colspan', 4).text('Loading price list…')));
	dst_get_state('prices').then(dst_reload_price_table);
};

const dst_reload_price_table = prices => {
	let tbody = $("div#price-editor tbody");
	tbody.empty();
	if(prices === null) prices = {};

	let fsec = $("select#price-editor-filter-security").val();
	let fbefore = $("input#price-editor-filter-before").val();
	let fafter = $("input#price-editor-filter-after").val();

	dst_get_state('securities').then(securities => {
		for(let ticker in prices) {
			if(fsec !== null && fsec !== "__all__" && fsec !== ticker) continue;

			for(let date in prices[ticker]) {
				if(fbefore !== "" && fbefore < date) continue;
				if(fafter !== "" && fafter > date) continue;

				tbody.append(dst_make_price_tr(
					ticker, date, prices[ticker][date],
					securities[ticker].currency
				));
			}
		}

		if(tbody.children().length === 0) {
			tbody.append(
				$(document.createElement('tr'))
					.addClass('placeholder')
					.append($(document.createElement('td')).prop('colspan', 4).text('Price list is empty or all filtered out.'))
			);
		}
	});
};

const dst_make_price_tr = (ticker, date, price, currency) => $(document.createElement('tr')).data('security', ticker).data('date', date).append(
	$(document.createElement('td')).append($(document.createElement('strong')).text(ticker)),
	$(document.createElement('td')).text(date),
	$(document.createElement('td')).append(dst_format_currency_amount(currency, price)).addClass('text-right'),
	$(document.createElement('td')).append(
		$(document.createElement('button')).addClass('btn btn-sm btn-secondary edit-price').text('Edit'),
		' ',
		$(document.createElement('button')).addClass('btn btn-sm btn-secondary delete-price').text('Delete')
	).addClass('text-right')
);

dst_on_load(() => {
	$("button#price-editor-new").click(() => {
		let modal = $("div#price-editor-modal");
		dst_reset_price_modal(modal);
		modal.modal('show');
	});
	$("select#price-editor-security").change(
		() => $("div#price-editor-currency").text($("select#price-editor-security").children(':selected').data('currency'))
	);
	$("button#price-editor-modal-cancel").click(() => $("div#price-editor-modal").modal('hide'));

	$("div#price-editor-modal form").submit(() => {
		$("button#price-editor-modal-save").prop('disabled', true);
		let date = $("input#price-editor-date").val();
		let ticker = $("select#price-editor-security").val();
		let price = parseFloat($("input#price-editor-price").val());

		dst_get_state('prices').then(prices => {
			if(prices === null) prices = {};
			if(!(ticker in prices)) prices[ticker] = {};
			prices[ticker][date] = price;
			dst_set_state('prices', prices).then(() => {
				let tr = dst_make_price_tr(ticker, date, price, $("select#price-editor-security").children(':selected').data('currency'));
				let oldtr = $("div#price-editor tbody > tr").filter((_, tr) => ($(tr).data('date') === date && $(tr).data('security') === ticker));

				if(oldtr.length === 0) {
					/* XXX: insert at the correct place */
					/* XXX: may even be filtered out */
					$("div#price-editor tbody").append(tr).children('tr.placeholder').remove();
				} else {
					oldtr.replaceWith(tr);
				}

				$("div#price-editor-modal").modal('hide');
			});
		});
	});

	$("div#price-editor tbody").on('click', 'button.delete-price', function() {
		let btn = $(this).prop('disabled', true);
		let tr = btn.closest('tr');
		let ticker = tr.data('security');
		let date = tr.data('date');

		dst_get_state('prices').then(prices => {
			delete prices[ticker][date];
			if($.isEmptyObject(prices[ticker])) {
				delete prices[ticker];
			}

			dst_set_state('prices', prices).then(() => tr.fadeOut(200, () => {
				tr.remove();
				if($.isEmptyObject(prices)) {
					dst_reload_price_table(prices);
				}
			}));
		});
	}).on('click', 'button.edit-price', function() {
		let tr = $(this).closest('tr');
		let ticker = tr.data('security');
		let date = tr.data('date');

		dst_get_state('prices').then(prices => {
			let modal = $("div#price-editor-modal");
			dst_reset_price_modal(modal);
			modal.find('.modal-title').text('Edit security price');
			modal.find('select#price-editor-security').val(ticker).change();
			modal.find('input#price-editor-date').val(date);
			modal.find('input#price-editor-price').val(prices[ticker][date]);
			modal.modal('show');
		});
	});

	$("button#price-editor-fetch").click(function() {
		let btn = $(this).prop('disabled', true);
		dst_get_states([ 'securities', 'prices' ]).then(state => {
			Promise.all(Object.values(state.securities).map(s => dst_fetch_quotes(s).then(quotes => [ s.ticker, quotes ]))).then(prices => {
				prices.forEach(pdata => {
					let ticker = pdata[0], quotes = pdata[1];
					if(!(ticker in state.prices)) state.prices[ticker] = {};
					for(let d in quotes) {
						state.prices[ticker][d] = quotes[d];
					}
				});

				dst_set_state('prices', state.prices).then(() => {
					dst_reload_price_table(state.prices);
					btn.prop('disabled', false);
				});
			});
		});
	});

	$("input#price-editor-filter-before").val(new Date().toISOString().split('T')[0]);
	$("input#price-editor-filter-after").val(new Date(Date.now() - 86400000 * 14).toISOString().split('T')[0]);
	$("form#price-editor-filter").submit(dst_fetch_and_reload_price_table);

	dst_on_securities_change(() => dst_fill_security_select($("select#price-editor-security, select#price-editor-filter-security")));
	dst_fetch_and_reload_price_table();
});
