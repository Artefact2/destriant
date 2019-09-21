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

const dst_fetch_and_regen_pf_table = () => dst_get_states([ 'securities', 'transactions', 'prices' ]).then(state => {
	let v = parseInt($("select#main-account-selector").val(), 10);
	let before = $("input#pf-date-select-date").val();
	let pfgen = dst_pf(state, {
		accounts: v === -1 ? null : [ v ],
	}, dst_two_consecutive_days_gen($("input#pf-date-select-date").val()));
	let ydaypf = pfgen.next().value;
	let tdaypf = pfgen.next().value;
	dst_regen_pf_table(state, tdaypf, ydaypf);
});

const dst_regen_pf_table = (state, pf, pfy) => {
	let tbody = $("div#pf tbody");
	let closedpnl = 0.0;
	tbody.empty();

	for(let tkr in pf.total.securities) {
		let s = pf.total.securities[tkr]
		let tr;
		if(Math.abs(s.quantity) < 1e-6){
			closedpnl += s.realized;
			continue;
		}

		tbody.append(tr = $(document.createElement('tr')).append(
			$(document.createElement('td')).append(
				$(document.createElement('strong')).text(tkr),
				', ', state.securities[tkr].name
			),
			$(document.createElement('td')).append(dst_format_fixed_amount(s.quantity, 4)),
			$(document.createElement('td')).append(dst_format_currency_amount(state.securities[tkr].currency, s.basis / s.quantity)),
			$(document.createElement('td')).append(dst_format_currency_amount(state.securities[tkr].currency, s.ltp)),
			$(document.createElement('td')).append(dst_format_percentage_gain(s.ltp / (s.basis / s.quantity))),
			$(document.createElement('td')).append(tkr in pfy.total.securities ? dst_format_percentage_gain(s.ltp / (pfy.total.securities[tkr].ltp)) : ''),
			$(document.createElement('td')).append(dst_format_currency_gain(state.securities[tkr].currency, s.realized + s.unrealized)),
			$(document.createElement('td')).append(dst_format_currency_amount(state.securities[tkr].currency, s.basis + s.unrealized)),
			$(document.createElement('td')).append((100.0 * (s.basis + s.unrealized) / (pf.total.basis + pf.total.unrealized - pf.total.cash.basis)).toFixed(2) + '%')
		));

		tr.children('td').slice(1).addClass('text-right');

		if(s.stale) {
			tr.find('span.currency-amount').slice(1).addClass('stale');
		}
		if(tkr in pfy.total.securities && pfy.total.securities[tkr].stale) {
			tr.find('span.currency-amount').get(3).addClass('stale');
		}
	}

	$("td#pf-total-pnl-closed").empty().append(dst_format_currency_gain('EUR', closedpnl)); /* XXX */

	let daypnl = pf.total.realized + pf.total.unrealized - pfy.total.realized - pfy.total.unrealized;
	let daypnlp = (pf.total.basis + pf.total.unrealized) / (pfy.total.basis + pfy.total.unrealized);
	$("h4#pf-day-change").empty().append(dst_format_currency_gain('EUR', daypnl)); /* XXX */
	$("h4#pf-day-change-percentage").empty().append(dst_format_percentage_gain(daypnlp));

	$(".pf-total-exposure, h4#pf-positions-value").empty().append(dst_format_currency_amount('EUR', pf.total.basis + pf.total.unrealized - pf.total.cash.basis)); /* XXX */
	$(".pf-total-pnl").empty().append(dst_format_currency_gain('EUR', pf.total.realized + pf.total.unrealized)); /* XXX */
	$("h4#pf-cash-available").empty().append(dst_format_currency_amount('EUR', pf.total.cash.basis)); /* XXX */
	$("h4#pf-account-value").empty().append(dst_format_currency_amount('EUR', pf.total.basis + pf.total.unrealized)); /* XXX */

	if(pf.total.stale) {
		$("th#pf-total-exposure, th#pf-total-pnl, h4#pf-positions-value, h4#pf-account-value").find('span.currency-amount').addClass('stale');
	}
	if(pf.total.stale || pfy.total.stale) {
		$("h4#pf-day-change, h4#pf-day-change-percentage").find('span.currency-amount').addClass('stale');
	}

	/* XXX: don't regen graphs every time, just update the data? */
	let profits = [ 'profits' ];
	let losses = [ 'losses' ];
	let exp = [ 'exposure' ];
	let names = [];
	for(let t in pf.total.securities) {
		if(Math.abs(pf.total.securities[t].quantity) < 1e-6) continue;
		let pnl = pf.total.securities[t].realized + pf.total.securities[t].unrealized;
		if(pnl >= 0) {
			profits.push(pnl);
			losses.push(0);
		} else {
			profits.push(0);
			losses.push(pnl);
		}
		exp.push(pf.total.securities[t].basis + pf.total.securities[t].unrealized);
		names.push(state.securities[t].name);
	}

	let chart = c3.generate({
		interaction: { enabled: false },
		bindto: '#pf-pnl-graph',
		size: {
			height: Math.min(500, (names.length + 1) * 30)
		},
		bar: {
			width: { ratio: .5 },
		},
		data: {
			columns: [ profits, losses ],
			type: 'bar',
			groups: [ [ 'profits', 'losses' ] ],
			colors: {
				profits: 'hsla(140, 100%, 60%, .8)',
				losses: 'hsla(20, 100%, 60%, .8)',
			},
		},
		axis: {
			rotated: true,
			x: {
				type: 'category',
				categories: names,
				tick: { multiline: false },
			}
		},
		legend: { show: false },
		grid: {
			x: { show: true },
			y: { show: true },
		},
	});
	let chart2 = c3.generate({
		interaction: { enabled: false },
		bindto: '#pf-exposure-graph',
		size: {
			height: Math.min(500, (names.length + 1) * 30)
		},
		bar: {
			width: { ratio: .5 },
		},
		data: {
			columns: [ exp ],
			type: 'bar',
			colors: {
				'exposure': 'hsla(200, 100%, 60%, .8)',
			},
		},
		axis: {
			rotated: true,
			x: {
				type: 'category',
				categories: names,
				tick: { multiline: false },
			}
		},
		legend: { show: false },
		grid: {
			x: { show: true },
			y: { show: true },
		},
	});
};

dst_on_load(() => {
	$("select#main-account-selector").change(dst_fetch_and_regen_pf_table);
	$("form#pf-date-select").submit(dst_fetch_and_regen_pf_table);
	$("input#pf-date-select-date").val(new Date().toISOString().split('T')[0]);

	$("td#pf-total-exposure-percent").append(dst_format_percentage(2));
	$("td#pf-total-exposure-closed").append(dst_format_currency_amount('EUR', 0.0)); /* XXX */
	$("td#pf-total-exposure-percent-closed").append(dst_format_percentage(1));
});
