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

let dst_chart_perf_account_value = null, dst_chart_perf_instrument_pnl = null, dst_chart_perf_cumulative_pnl = null;

const dst_generate_day_range = function*(start, end, inc) {
	let d = dst_lte_trading_day(start), ymd;
	end = dst_lte_trading_day(end).toISOString().split('T')[0];

	while(1) {
		ymd = d.toISOString().split('T')[0];

		if(ymd <= end) {
			yield ymd;
		}

		if(ymd == end) {
			return;
		} else if(ymd > end) {
			yield end;
			return;
		}

		d.setDate(d.getDate() + inc);
		switch(d.getDay()) {
		case 0:
			d.setDate(d.getDate() + 1);
			break;
		case 6:
			d.setDate(d.getDate() + 2);
			break;
		}
	}
};

const dst_generate_months_range = function*(start, end) {
	end = new Date(dst_lte_trading_day(end)).toISOString().split('T')[0];
	let d = new Date(start);
	let m = d.getMonth();
	d.setDate(d.getDate() + 1);
	if(m === d.getMonth()) {
		/* start is not last day of a month, jump to last day of previous month */
		d.setDate(0);
	} else {
		d.setDate(d.getDate() - 1);
	}
	let ymd;

	while(1) {
		ymd = d.toISOString().split('T')[0];

		if(ymd <= end) {
			yield ymd;
		}

		if(ymd === end) {
			return;
		} else if(ymd > end) {
			yield end;
			return;
		}

		d.setDate(d.getDate() + 1);
		d.setMonth(d.getMonth() + 1);
		d.setDate(d.getDate() - 1);
	}
};

const dst_lerp_root = (x1, x2, y1, y2) => {
	let a = (y2 - y1) / (x2 - x1);
	let b = y2 - a * x2;
	return -b / a;
};

const dst_regen_perf = state => {
	let start = $("input#perf-date-start").val();
	let end = $("input#perf-date-end").val();
	let account = parseInt($("select#main-account-selector").val(), 10);

	let spf = null, epf = null, ppf = null;
	let values = [ [ 'x' ], [ 'accountval' ] ];
	let cx = [ 'x' ];
	let cprofits = [ 'profits' ];
	let closses = [ 'losses' ];
	let ppnl = null;
	let pdate = null;

	let endtime = new Date(end).getTime();
	let starttime = new Date(start).getTime();
	let ndays = (endtime - starttime) / 86400000.0;
	let inc = Math.max(1, Math.floor(ndays / 100));

	for(let pf of dst_pf(state, { accounts: account === -1 ? null : [ account ] }, dst_generate_day_range(start, end, inc))) {
		if(spf === null) spf = pf;
		epf = pf;
		values[0].push(pf.date);
		values[1].push(pf.total.basis + pf.total.unrealized);

		let pnl = pf.total.realized + pf.total.closed + pf.total.unrealized - spf.total.realized - spf.total.closed - spf.total.unrealized;
		if(ppnl !== null && ((pnl >= 0 && ppnl < 0) || (pnl < 0 && ppnl >= 0))) {
			cx.push(dst_lerp_root(new Date(pdate).getTime(), new Date(pf.date).getTime(), pnl, ppnl));
			cprofits.push(0);
			closses.push(0);
		}
		if(pnl >= 0) {
			cprofits.push(pnl);
			closses.push(null);
		} else {
			cprofits.push(null);
			closses.push(pnl);
		}
		cx.push(pf.date);
		ppnl = pnl;
		pdate = pf.date;
		ppf = pf;
	}

	if(dst_chart_perf_account_value === null) dst_generate_perf_charts();
	dst_chart_perf_account_value.load({
		unload: true,
		columns: values,
	});
	dst_chart_perf_cumulative_pnl.load({
		unload: true,
		columns: [ cx, cprofits, closses ],
	});

	let profits = [ 'profits' ];
	let losses = [ 'losses' ];
	let categories = [];
	let gainers = [];

	for(let t of dst_sorted_pf_securities(epf, state.securities, state.settings)) {
		let pnl = epf.total.securities[t].realized + epf.total.securities[t].closed + epf.total.securities[t].unrealized;
		if(t in spf.total.securities) {
			pnl -= spf.total.securities[t].realized + spf.total.securities[t].closed + spf.total.securities[t].unrealized;
		}
		if(Math.abs(epf.total.securities[t].quantity) < 1e-6 && Math.abs(pnl) < 1e-6) continue;

		if(pnl >= 0) {
			profits.push(pnl);
			losses.push(0);
		} else {
			profits.push(0);
			losses.push(pnl);
		}
		categories.push(state.securities[t].name.substring(0, 50));
		gainers.push([ state.securities[t].name, pnl, epf.total.securities[t].stale || ((t in spf.total.securities) && spf.total.securities[t].stale) ]);
	}
	dst_chart_perf_instrument_pnl.load({
		unload: true,
		columns: [ profits, losses ],
		categories: categories,
	});
	dst_chart_perf_instrument_pnl.resize({ height: Math.min(500, (categories.length + 1) * 30) });

	$("span#perf-start-date").text(spf.date);
	$("span#perf-end-date").text(epf.date);
	$("td#perf-start-value").empty().append(dst_format_currency_amount('EUR', spf.total.basis + spf.total.unrealized)); /* XXX */
	$("td#perf-end-value").empty().append(dst_format_currency_amount('EUR', epf.total.basis + epf.total.unrealized)); /* XXX */
	$("td#perf-realized-pnl").empty().append(dst_format_currency_gain('EUR', epf.total.realized + epf.total.closed - spf.total.realized - spf.total.closed)); /* XXX */
	$(".perf-pnl").empty().append(dst_format_currency_gain('EUR', epf.total.realized + epf.total.closed + epf.total.unrealized - spf.total.realized - spf.total.closed - spf.total.unrealized)); /* XXX */
	$("td#perf-cash-xfers").empty().append(dst_format_currency_amount('EUR', epf.total.basis - epf.total.realized - epf.total.closed - spf.total.basis + spf.total.realized + spf.total.closed)); /* XXX */
	$("td#perf-value-delta").empty().append(dst_format_currency_amount('EUR', epf.total.basis + epf.total.unrealized - spf.total.basis - spf.total.unrealized)); /* XXX */

	$("div#perf .stale").removeClass('stale');
	if(spf.total.stale) {
		$("td#perf-start-value, .perf-pnl, td#perf-value-delta").find('span.currency-amount').addClass('stale');
	}
	if(epf.total.stale) {
		$("td#perf-end-value, .perf-pnl, td#perf-value-delta").find('span.currency-amount').addClass('stale');
	}

	if(gainers.length > 0) {
		gainers.sort((a, b) => a[1] - b[1]);
		if(gainers[0][1] >= 0) {
			$("table#perf-top-losers tbody").empty().append(
				$(document.createElement('tr')).append(
					$(document.createElement('td')).append(
						$(document.createElement('small')).addClass('text-muted').text('No data available')
					)
				)
			);
		} else {
			let tbody = $("table#perf-top-losers tbody").empty(), span;
			for(let i = 0; i < 3 && i < gainers.length && gainers[i][1] < 0; ++i) {
				tbody.append($(document.createElement('tr')).append(
					$(document.createElement('td')).append(
						$(document.createElement('small')).addClass('text-muted').text(gainers[i][0])
					),
					$(document.createElement('td')).addClass('text-right').append(
						span = dst_format_currency_gain('EUR', gainers[i][1]) /* XXX */
					)
				));
				if(gainers[i][2]) span.addClass('stale');
			}
		}
		if(gainers[gainers.length - 1][1] <= 0) {
			$("table#perf-top-gainers tbody").empty().append(
				$(document.createElement('tr')).append(
					$(document.createElement('td')).append(
						$(document.createElement('small')).addClass('text-muted').text('No data available')
					)
				)
			);
		} else {
			let tbody = $("table#perf-top-gainers tbody").empty(), span;
			for(let i = gainers.length - 1; i >= gainers.length - 3 && i >= 0 && gainers[i][1] > 0; --i) {
				tbody.append($(document.createElement('tr')).append(
					$(document.createElement('td')).append(
						$(document.createElement('small')).addClass('text-muted').text(gainers[i][0])
					),
					$(document.createElement('td')).addClass('text-right').append(
						span = dst_format_currency_gain('EUR', gainers[i][1]) /* XXX */
					)
				));
				if(gainers[i][2]) span.addClass('stale');
			}
		}
	}
};

const dst_regen_monthly_pnl = state => {
	let work = state => {
		let start, end, ppf = null, monthlypnl = {};
		let account = parseInt($("select#main-account-selector").val(), 10);
		if(account === -1 && state.transactions.length > 0) {
			start = state.transactions[0];
		} else {
			start = state.transactions.find(tx => tx.id === account);
		}
		end = new Date().toISOString().split('T')[0];
		if(typeof start === 'undefined') start = end;
		else start = start.date;
		for(let pf of dst_pf(state, { accounts: account === -1 ? null : [ account ] }, dst_generate_months_range(start, end))) {
			if(ppf === null) {
				ppf = pf;
				continue;
			}

			let pnl = pf.total.realized + pf.total.closed + pf.total.unrealized - ppf.total.realized - pf.total.closed - ppf.total.unrealized;
			if(Math.abs(pnl) < 1e-6) {
				ppf = pf;
				continue;
			}

			let year = pf.date.split('-');
			let month = parseInt(year[1], 10);
			year = parseInt(year[0], 10);

			if(!(year in monthlypnl)) monthlypnl[year] = {};
			monthlypnl[year][month] = [ pnl, pf.total.stale || ppf.total.stale ];
			ppf = pf;
		}
		let tbody = $("table#perf-monthly-pnl tbody").empty();
		let ty = new Date().toISOString().split('-');
		let tm = parseInt(ty[1], 10);
		ty = parseInt(ty[0], 10).toString();
		for(let y in monthlypnl) {
			let tr, td, span, stale = false;
			let s = 0.0;
			tbody.prepend(tr = $(document.createElement('tr')));
			tr.append($(document.createElement('td')).text(y));

			for(let m = 1; m <= 12; ++m) {
				tr.append(td = $(document.createElement('td')));
				if(!(m in monthlypnl[y])) continue;
				td.append(span = dst_format_currency_gain('EUR', monthlypnl[y][m][0])); /* XXX */
				if(ty === y && tm === m) {
					span.addClass('to-date');
				}
				if(monthlypnl[y][m][1]) {
					stale = true;
					span.addClass('stale');
				}
				s += monthlypnl[y][m][0];
			}

			tr.append($(document.createElement('td')).append(span = dst_format_currency_gain('EUR', s))); /* XXX */
			if(y === ty) span.addClass('to-date');
			if(stale) span.addClass('stale'); /* XXX: only need dec-31 of prev year and dec-31 of this year to not be stale */
		}
	};

	if(typeof state === 'undefined') {
		return dst_get_state([ 'transactions', 'prices', 'accounts', 'securities' ]).then(state => work(state));
	} else {
		return new Promise((resolve, reject) => resolve(work(state)));
	}
};

const dst_generate_perf_charts = () => {
	dst_chart_perf_account_value = c3.generate({
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

	dst_chart_perf_instrument_pnl = c3.generate({
		interaction: { enabled: false },
		transition: { duration: 0 },
		bindto: 'div#perf-instrument-pnl-graph',
		size: { height: 250 },
		bar: {
			width: { ratio: .5 },
		},
		data: {
			columns: [],
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
				tick: { multiline: false },
			}
		},
		legend: { show: false },
		grid: {
			x: { show: true },
			y: { show: true },
		},
	});

	dst_chart_perf_cumulative_pnl = c3.generate({
		interaction: { enabled: false },
		transition: { duration: 0 },
		bindto: 'div#perf-cumulative-pnl-graph',
		size: { height: 250 },
		data: {
			columns: [],
			x: 'x',
			type: 'area',
			colors: {
				profits: 'hsla(140, 100%, 60%, .8)',
				losses: 'hsla(20, 100%, 60%, .8)',
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
		point: { show: false },
	});

};

dst_on_load(() => {
	$("div#perf").on('dst-load', () => dst_get_states([ 'securities', 'accounts', 'transactions', 'prices', 'settings' ]).then(state => {
		dst_regen_perf(state);
		dst_regen_monthly_pnl(state);
	})).on('dst-show', () => {
		if(dst_chart_perf_account_value === null) return;
		dst_chart_perf_account_value.flush();
		dst_chart_perf_instrument_pnl.flush();
		dst_chart_perf_cumulative_pnl.flush();
	});
	$("form#perf-date-selector").submit(function(e) {
		e.preventDefault();
		dst_get_states([ 'securities', 'accounts', 'transactions', 'prices', 'settings' ]).then(dst_regen_perf);
	});
	$("select#main-account-selector").change(() => dst_mark_stale($("div#perf")));
	dst_on_state_change([ 'accounts', 'securities', 'txs', 'prices', 'settings' ], () => dst_mark_stale($("div#perf")));
});
