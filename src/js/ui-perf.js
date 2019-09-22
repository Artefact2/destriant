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

let dst_chart_perf_account_value = null;

const dst_set_perf_range = rewind => (() => {
	let d = new Date();
	$("input#perf-date-end").val(d.toISOString().split('T')[0]);
	rewind(d);
	$("input#perf-date-start").val(d.toISOString().split('T')[0]);
	$("form#perf-date-selector").submit();
});

const dst_generate_day_range = function*(start, end, inc) {
	let d = new Date(start);
	let ymd;

	while(1) {
		ymd = d.toISOString().split('T')[0];

		yield ymd;
		if(ymd == end) {
			return;
		} else if(ymd > end) {
			yield end;
			return;
		}

		d.setDate(d.getDate() + inc);
	}
};

const dst_irr = cashflows => {
	if(cashflows.length < 2) return 1;

	let fv = (rate, cashflows) => {
		rate = Math.log(rate);
		let nav = 0.0;
		let time = 0.0;
		for(let cf of cashflows) {
			nav *= Math.exp(rate * (cf[0] - time));
			nav += cf[1];
			time = cf[0];
		}
		return nav;
	};

	let m = 0, M = 11;
	while(M - m >= .00005) {
		let mid = (m + M) / 2.0;
		if(fv(mid, cashflows) > 0.0) {
			M = mid;
		} else {
			m = mid;
		}
	}

	return m;
};

const dst_fetch_and_regen_perf = () => dst_get_states([ 'securities', 'accounts', 'transactions', 'prices' ]).then(state => dst_regen_perf(state));
const dst_regen_perf = state => {
	let start = $("input#perf-date-start").val();
	let end = $("input#perf-date-end").val();
	let account = parseInt($("select#main-account-selector").val(), 10);

	let spf = null, epf = null, ppf = null;
	let values = [ [ 'x' ], [ 'accountval' ] ];
	let cashflows = [];

	let endtime = new Date(end).getTime();
	let starttime = new Date(start).getTime();
	let ndays = (endtime - starttime) / 86400000.0;
	let inc = Math.max(1, Math.floor(ndays / 100));

	for(let pf of dst_pf(state, { accounts: account === -1 ? null : [ account ] }, dst_generate_day_range(start, end, inc))) {
		if(spf === null) spf = pf;
		epf = pf;
		values[0].push(pf.date);
		values[1].push(pf.total.basis + pf.total.unrealized);

		if(ppf === null) {
			cashflows.push([ (new Date(pf.date).getTime() - starttime) / (endtime - starttime), pf.total.basis + pf.total.unrealized ]);
			ppf = pf;
		} else {
			let cf = pf.total.basis - pf.total.realized - ppf.total.basis + ppf.total.realized;
			ppf = pf;
			if(Math.abs(cf) > 1e-6) {
				cashflows.push([ (new Date(pf.date).getTime() - starttime) / (endtime - starttime), cf ]);
			}
		}
	}

	cashflows.push([ 1, -epf.total.basis - epf.total.unrealized ]);
	let irr = dst_irr(cashflows);

	if(dst_chart_perf_account_value === null) dst_generate_perf_charts();
	dst_chart_perf_account_value.load({
		unload: true,
		columns: values,
	});

	$("span#perf-start-date").text(spf.date);
	$("span#perf-end-date").text(epf.date);
	$("td#perf-start-value").empty().append(dst_format_currency_amount('EUR', spf.total.basis + spf.total.unrealized)); /* XXX */
	$("td#perf-end-value").empty().append(dst_format_currency_amount('EUR', epf.total.basis + epf.total.unrealized)); /* XXX */
	$("td#perf-realized-pnl").empty().append(dst_format_currency_gain('EUR', epf.total.realized - spf.total.realized)); /* XXX */
	$("td#perf-pnl").empty().append(dst_format_currency_gain('EUR', epf.total.realized + epf.total.unrealized - spf.total.realized - spf.total.unrealized)); /* XXX */
	$("td#perf-cash-xfers").empty().append(dst_format_currency_amount('EUR', epf.total.basis - epf.total.realized - spf.total.basis + spf.total.realized)); /* XXX */
	$("td#perf-value-delta").empty().append(dst_format_currency_amount('EUR', epf.total.basis + epf.total.unrealized - spf.total.basis - spf.total.unrealized)); /* XXX */
	if(ndays > 365) {
		$("td#perf-irr").empty().append(
			$(document.createElement('small')).addClass('text-muted').text('annualized '),
			dst_format_percentage_gain(Math.exp(Math.log(irr) / (ndays / 365.25)))
		);
	} else {
		$("td#perf-irr").empty().append(dst_format_percentage_gain(irr));
	}

	$("div#perf .stale").removeClass('stale');
	if(spf.total.stale) {
		$("td#perf-start-value, td#perf-pnl, td#perf-value-delta, td#perf-irr").find('span.currency-amount').addClass('stale');
	}
	if(epf.total.stale) {
		$("td#perf-end-value, td#perf-pnl, td#perf-value-delta, td#perf-irr").find('span.currency-amount').addClass('stale');
	}
};

const dst_generate_perf_charts = () => dst_chart_perf_account_value = c3.generate({
	interaction: { enabled: false },
	transition: { duration: 0 },
	bindto: 'div#perf-account-value-graph',
	size: { height: 250 },
	data: {
		x: 'x',
		columns: [],
		type: 'area',
		colors: {
			accountval: 'hsla(200, 100%, 60%, .8)',
		},
	},
	axis: {
		x: {
			type: 'timeseries',
			tick: { format: '%Y-%m-%d' },
		},
	},
	legend: { show: false },
	grid: {
		x: { show: true },
		y: { show: true },
	},
	area: { zerobased: false },
	point: { show: false },
});

dst_on_load(() => {
	$("button#perf-date-5y").click(dst_set_perf_range(d => d.setFullYear(d.getFullYear() - 5)));
	$("button#perf-date-2y").click(dst_set_perf_range(d => d.setFullYear(d.getFullYear() - 2)));
	$("button#perf-date-1y").click(dst_set_perf_range(d => d.setFullYear(d.getFullYear() - 1)));
	$("button#perf-date-6m").click(dst_set_perf_range(d => d.setMonth(d.getMonth() - 6)));
	$("button#perf-date-3m").click(dst_set_perf_range(d => d.setMonth(d.getMonth() - 3)));
	$("button#perf-date-ytd").click(dst_set_perf_range(d => { d.setMonth(0); d.setDate(1); })).click();
	$("button#perf-date-mtd").click(dst_set_perf_range(d => d.setDate(1)));

	$("div#perf").on('dst-load', dst_fetch_and_regen_perf);
	$("form#perf-date-selector").submit(() => dst_mark_stale($("div#perf")));
	$("select#main-account-selector").change(() => dst_mark_stale($("div#perf")));
	dst_on_securities_change(() => dst_mark_stale($("div#perf")));
	dst_on_tx_change(() => dst_mark_stale($("div#perf")));
	dst_on_prices_change(() => dst_mark_stale($("div#perf")));
});
