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

let dst_auto_fetch_prices_timeout = null;
const dst_auto_fetch_prices = () => dst_get_state('settings').then(settings => {
	dst_auto_fetch_prices_timeout = null;
	if(settings === null) return;
	if(!('auto-quotes' in settings) || !settings['auto-quotes']) return;

	let last = ('auto-quotes-last' in settings) ? settings['auto-quotes-last'] : 0;
	let ival = 60000 * settings['auto-quotes-frequency'];
	let next = last + ival;
	let cur = new Date().getTime();

	if(cur < next) {
		dst_auto_fetch_prices_timeout = setTimeout(dst_auto_fetch_prices, next - cur + 1000);
	} else {
		settings['auto-quotes-last'] = cur;
		dst_set_state('settings', settings).then(() => {
			dst_auto_fetch_prices_timeout = setTimeout(dst_auto_fetch_prices, ival);
			let d = new Date();
			if(d.getDay() === 0 || d.getDay() === 6) return;
			if('auto-quotes-before' in settings) {
				let before = settings['auto-quotes-before'].split(':').map(s => parseInt(s, 10));
				if(d.getHours() > before[0]) return;
				if(d.getHours() === before[0] && d.getMinutes() > before[1]) return;
			}
			if('auto-quotes-after' in settings) {
				let after = settings['auto-quotes-after'].split(':').map(s => parseInt(s, 10));
				if(d.getHours() < after[0]) return;
				if(d.getHours() === after[0] && d.getMinutes() < after[1]) return;
			}
			$('button#price-editor-fetch').click();
		});
	}
});

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

const dst_import_prices = (text, fmt, ticker) => dst_get_state('prices').then(prices => {
	if(prices === null) prices = {};

	if(fmt === 'raw') {
		dst_import_raw_prices(prices, ticker, text);
	} else if(fmt === 'bdcsv') {
		dst_import_bdcsv_prices(prices, ticker, text);
	} else {
		console.error("unknown import price fmt", fmt);
	}

	return prices;
}).then(prices => {
	dst_set_state('prices', prices);
	dst_trigger_state_change('prices', prices);
	return prices;
});

const dst_import_raw_prices = (prices, ticker, text) => {
	let s = JSON.parse(text);
	console.assert($.isArray(s));
	s.forEach(row => {
		console.assert(row.length === 3);
		console.assert(typeof row[0] === "string" && typeof row[1] === "string" && typeof row[2] === "number");
		console.assert(row[1].match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/));
		if(!(row[0] in prices)) prices[row[0]] = {};
		prices[row[0]][row[1]] = row[2];
	});
};

const dst_import_bdcsv_prices = (prices, ticker, csv) => {
	console.assert(ticker !== "__auto__");
	if(ticker === "__auto__") return;

	if(!(ticker in prices)) prices[ticker] = {};
	let db = prices[ticker];

	csv = csv.split("\n");
	let cols = csv.shift().split(";");
	console.assert(cols.length === 7 && cols[0] === "Date" && cols[4] === "Close"); /* XXX: check currency column */
	for(let line of csv) {
		if(line === "") continue;
		line = line.split(";");
		let date = line[0].substring(1).split(' ')[0].replace(/\//g, '-');
		let val = parseFloat(line[4]);
		db[date] = val;
	}
};

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

	$("div#price-editor-modal form").submit(function(e) {
		e.preventDefault();
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
				dst_trigger_state_change('prices', prices);
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
				dst_trigger_state_change('prices', prices);
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
		let btn = $(this);
		dst_get_states([ 'securities', 'prices', 'transactions', 'accounts' ]).then(state => {
			if(state.prices === null) state.prices = {};
			if(state.securities === null) state.securities = {};
			let pf = dst_pf(state, {}, (function*() { yield new Date(); })()).next().value;
			let securities = Object.keys(pf.total.securities).filter(tkr => Math.abs(pf.total.securities[tkr].quantity) > 1e-6);
			dst_set_btn_spinner(btn, securities.length);
			Promise.all(securities.map(tkr => dst_fetch_quotes(state.securities[tkr]).then(quotes => {
				dst_set_btn_spinner_progress(btn, 1);
				return [ tkr, quotes ];
			}))).then(prices => {
				prices.forEach(pdata => {
					let ticker = pdata[0], quotes = pdata[1];
					if(!(ticker in state.prices)) state.prices[ticker] = {};
					for(let d in quotes) {
						state.prices[ticker][d] = quotes[d];
					}
				});

				dst_set_state('prices', state.prices).then(() => {
					dst_mark_stale($("div#price-editor"));
					dst_trigger_state_change('prices', state.prices);
					dst_unset_btn_spinner(btn);
				});
			});
		});
	});

	$("div#security-editor table").on('click', 'button.fetch-prices', function() {
		let btn = $(this);
		dst_set_btn_spinner(btn);

		dst_get_states([ 'securities', 'prices' ]).then(state => {
			if(state.prices === null) state.prices = {};
			if(state.securities === null) state.securities = {};
			let tkr = $(this).closest('tr').data('ticker');
			return dst_fetch_quotes(state.securities[tkr]).then(quotes => [ state.prices, tkr, quotes ]);
		}).then(state => {
			if(!(state[1] in state[0])) {
				state[0][state[1]] = {};
			}
			for(let d in state[2]) {
				state[0][state[1]][d] = state[2][d];
			}
			return state[0];
		}).then(prices => {
			return dst_set_state('prices', prices).then(() => prices);
		}).then(prices => {
			dst_mark_stale($("div#price-editor"));
			dst_trigger_state_change('prices', prices);
			dst_unset_btn_spinner(btn);
		});
	});

	$("button#price-editor-import").click(() => {
		let modal = $("div#price-editor-import-modal");
		modal.find('form')[0].reset();
		modal.find('form select').change();
		modal.find('form button').prop('disabled', false);
		modal.modal('show');
	});
	$("button#price-editor-import-modal-cancel").click(() => $("div#price-editor-import-modal").modal('hide'));
	$("select#price-editor-import-format").change(function() {
		let v = $(this).val();
		let ta = $("textarea#price-editor-import-text");

		switch(v) {
		case 'raw':
			ta.prop('placeholder', '[["FOO", "2019-04-24", 12.34], ["BAR", "2019-05-25", 56.78], …]');
			break;

		case 'bdcsv':
			ta.prop('placeholder', "Date;Open;High;Low;Close;Volume;Currency\n\"2015/11/06 01:00\";100.45000000;100.45000000;100.02170000;100.02170000;0;EUR\n…");
			break;
		}
	});
	$("div#price-editor-import-modal form").submit(function(e) {
		e.preventDefault();
		$("button#price-editor-import-modal-save").prop('disabled', true);
		let modal = $("div#price-editor-import-modal");
		let fmt = $("select#price-editor-import-format").val();
		let finp = $("input#price-editor-import-file");
		let ticker = $("select#price-editor-import-security").val();

		if(finp[0].files.length > 0) {
			let r = new FileReader();
			r.onload = () => dst_import_prices(r.result, fmt, ticker).then(() => modal.modal('hide'));
			r.readAsText(finp[0].files[0]);
		} else {
			dst_import_prices($("textarea#price-editor-import-text").val(), fmt, ticker).then(() => modal.modal('hide'));
		}
	});

	$("input#price-editor-filter-before").val(new Date().toISOString().split('T')[0]);
	$("input#price-editor-filter-after").val(new Date(Date.now() - 86400000 * 14).toISOString().split('T')[0]);
	$("form#price-editor-filter").submit(function(e) {
		e.preventDefault();
		dst_mark_stale($("div#price-editor"));
	});

	dst_on_state_change('securities', securities => dst_fill_security_select(
		$("select#price-editor-security, select#price-editor-filter-security, select#price-editor-import-security"),
		securities
	));

	$("div#price-editor").on('dst-load', dst_fetch_and_reload_price_table);

	dst_on_state_change('settings', settings => {
		if(settings !== null && 'auto-quotes' in settings && settings['auto-quotes']) {
			dst_auto_fetch_prices();
		} else {
			clearTimeout(dst_auto_fetch_prices_timeout);
			dst_auto_fetch_prices_timeout = null;
		}
	});
});
