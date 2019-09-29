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

let dst_chart_returns_account_returns = null;

/** @param cashflows [ [ <time>, <cash-flow> ], [ <time>, <cash-flow> ], … ] with 0≤t≤1 */
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

/** @param cashflows [ [ <cash-flow>, <final-value> ], [ <cash-flow>, <final-value> ], … ] */
const dst_twr = cashflows => {
	if(cashflows.length < 2) return 1;
	let r = 1.0, imax = cashflows.length;
	for(let i = 1; i < imax; ++i) {
		if(Math.abs(cashflows[i-1][1]) < 1e-6) continue;
		r *= (cashflows[i][1] - cashflows[i][0]) / cashflows[i-1][1];
	}
	return r;
};

const dst_generate_tx_dates = function*(txs, start, end) {
	if(!$.isArray(txs)) return;

	start = new Date(start).toISOString().split('T')[0];
	end = new Date(end).toISOString().split('T')[0];

	for(let tx of txs) {
		if(tx.date > end) return;
		if(tx.date < start) continue;

		yield tx.date;
		start = new Date(tx.date);
		start.setDate(start.getDate() + 1);
		start = start.toISOString().split('T')[0];
	}
};

const dst_merge_generators = function*(A, B) {
	let a = A.next(), b = B.next();

	while(a.done !== true || b.done !== true) {
		if(a.done === true || b.value < a.value) {
			yield b.value;
			b = B.next();
			continue;
		}
		if(b.done === true || a.value < b.value) {
			yield a.value;
			a = A.next();
			continue;
		}

		yield a.value;
		a = A.next();
		b = B.next();
	}
};

const dst_regen_returns = state => {
	if(typeof state === 'undefined') {
		return dst_get_states([ 'securities', 'accounts', 'transactions', 'prices' ]).then(dst_regen_returns);
	}

	if(dst_chart_returns_account_returns === null) {
		dst_chart_returns_account_returns = c3.generate({
			interaction: { enabled: false },
			transition: { duration: 0 },
			bindto: 'div#returns-account-returns-graph',
			size: { height: 250 },
			data: {
				x: 'x',
				columns: [],
				colors: {
				positive: 'hsla(140, 100%, 60%, .8)',
					negative: 'hsla(20, 100%, 60%, .8)',
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
		});
	}

	let start = $("input#returns-date-start").val();
	let end = $("input#returns-date-end").val();
	let filters = {
		accounts: [ parseInt($("select#main-account-selector").val(), 10) ],
	};
	if(filters.accounts[0] === -1) filters.accounts = null;
	let ndays = (new Date(end).getTime() - new Date(start).getTime()) / 86400000.0;
	let inc = Math.max(1, Math.floor(ndays / 100)); /* XXX: refactor with ui-perf */

	let cx = [ 'x' ];
	let cp = [ 'positive' ];
	let cn = [ 'negative' ];
	let cashflows = [], twr, prevtwr = null, ppf = null;

	for(let pf of dst_pf(state, filters, dst_generate_day_range(start, end, inc))) {
		if(ppf === null) {
			prevtwr = twr = 0.0;
			cashflows.push([ pf.total.basis + pf.total.unrealized, pf.total.basis + pf.total.unrealized ]);
		} else {
			let cf = pf.total.basis - pf.total.realized - pf.total.closed - ppf.total.basis + ppf.total.realized + ppf.total.closed;
			if(Math.abs(cf) > 1e-6) {
				cashflows.push([ cf, pf.total.basis + pf.total.unrealized ]);
			}

			cashflows.push([ -pf.total.basis - pf.total.unrealized, 0 ]);
			twr = 100.0 * (dst_twr(cashflows) - 1.00);
			cashflows.pop();
		}

		if((twr >= 0 && prevtwr < 0) || (twr < 0 && prevtwr >= 0)) {
			cx.push(dst_lerp_root(new Date(ppf.date).getTime(), new Date(pf.date).getTime(), prevtwr, twr));
			cp.push(0);
			cn.push(0);
		}
		cx.push(pf.date);
		if(twr >= 0) {
			cp.push(twr);
			cn.push(null);
		} else {
			cp.push(null);
			cn.push(twr);
		}

		ppf = pf;
		prevtwr = twr;
	}

	dst_chart_returns_account_returns.load({
		unload: true,
		columns: [ cx, cp, cn ],
	});

	let maxdd = null, pfpeak = null, pfv;
	cashflows = [];
	ppf = null;
	for(let pf of dst_pf(state, filters, dst_generate_day_range(start, end, 1))) {
		let empty = Math.abs(pf.total.basis) < 1e-6;

		if(ppf === null) {
			if(empty) continue;
			cashflows.push([ pf.date, pf.total.basis + pf.total.unrealized, pf.total.basis + pf.total.unrealized ]);
		} else {
			let cf = pf.total.basis - pf.total.realized - pf.total.closed - ppf.total.basis + ppf.total.realized + ppf.total.closed;
			if(Math.abs(cf) > 1e-6) {
				cashflows.push([ pf.date, cf, pf.total.basis + pf.total.unrealized ]);
			}
		}

		if(empty) {
			ppf = null;
		} else {
			ppf = pf;
		}

		pfv = pf.total.basis + pf.total.unrealized;
		if(maxdd === null) {
			maxdd = [ pf.date, pf.date, 1.0 ];
			pfpeak = [ pf.date, pfv ];
		} else {
			if(pfv > pfpeak[1]) {
				pfpeak[0] = pf.date;
				pfpeak[1] = pfv;
			}

			if(Math.abs(pfpeak[1]) > 1e-6 && (pfv / pfpeak[1]) < maxdd[2]) {
				maxdd = [ pfpeak[0], pf.date, pfv / pfpeak[1] ];
			}
		}
	}

	if(ppf !== null) {
		cashflows.push([ ppf.date, -ppf.total.basis - ppf.total.unrealized, 0 ]);
	}

	if(cashflows.length >= 2) {
		let irr = dst_irr(cashflows.map(((a, b) => cf => [ (new Date(cf[0]).getTime() - a)/(b - a), cf[1] ])(
			new Date(cashflows[0][0]).getTime(), new Date(cashflows[cashflows.length - 1][0]).getTime()
		)));
		twr = dst_twr(cashflows.map(cf => [ cf[1], cf[2] ]));

		let tds = $("td#returns-irr, td#returns-twr").empty();
		let nyears = (new Date(cashflows[cashflows.length - 1][0]) - new Date(cashflows[0][0]).getTime()) / (86400000 * 365.25);
		if(nyears > 1.01) {
			tds.append($(document.createElement('small')).addClass('text-muted mr-2').text('annualized'));
			irr = Math.exp(Math.log(irr) / nyears);
			twr = Math.exp(Math.log(twr) / nyears);
		}

		$("td#returns-irr").append(dst_format_percentage_gain(irr));
		$("td#returns-twr").append(dst_format_percentage_gain(twr));
	} else {
		$("td#returns-irr, td#returns-twr").empty().text('N/A');
	}

	if(maxdd[2] < 1) {
		$("td#returns-maxdd").empty().append(dst_format_percentage(maxdd[2]));
		$("td#returns-maxdd-period").empty().append($(document.createElement('small')).text(maxdd[0] + ' — ' + maxdd[1]));
	} else {
		$("td#returns-maxdd, td#returns-maxdd-period").empty().text('N/A');
	}
};

const dst_regen_returns_table = state => {
	let tbody = $("table#returns-monthly-irr > tbody").empty();
	let filters = {
		accounts: [ parseInt($("select#main-account-selector").val(), 10) ],
	};
	if(filters.accounts[0] === -1) filters.accounts = null;
	let start, end = new Date();
	if(filters.accounts === null && state.transactions.length > 0) {
		start = state.transactions[0];
	} else {
		start = state.transactions.find(tx => tx.account === filters.accounts[0]);
	}
	if(typeof start === 'undefined') start = new Date();
	else start = start.date;

	let irr = {};
	let flows = [], yflows = [];
	let ppf = null, date, month, year, cf;

	let eom = pf => {
		if(flows.length === 0) return;
		/* end of month */
		let end = date.getTime(), start = flows[0][0];
		if(Math.abs(pf.total.basis) > 1e-6) {
			flows.push([ end, -pf.total.basis - pf.total.unrealized ]);
		} else {
			end = flows[flows.length - 1][0];
		}
		year = date.getFullYear();
		if(!(year in irr)) irr[year] = {};
		irr[year][month] = dst_irr(flows.map(f => [ (f[0] - start) / (end - start), f[1] ]));
		flows = [];
	};
	let eoy = pf => {
		if(yflows.length === 0) return;
		/* end of year */
		let end = date.getTime(), start = yflows[0][0];
		if(Math.abs(pf.total.basis) > 1e-6) {
			yflows.push([ end, -pf.total.basis - pf.total.unrealized, 0 ]);
		} else {
			end = yflows[yflows.length - 1][0];
		}
		year = date.getFullYear();
		irr[year][12] = dst_irr(yflows.map(f => [ (f[0] - start) / (end - start), f[1] ]));
		irr[year][13] = dst_twr(yflows.map(f => [ f[1], f[2] ]));
		yflows = [];
	}

	/* XXX: handle stale prices */
	for(let pf of dst_pf(state, filters, dst_merge_generators(
		dst_generate_months_range(start, end),
		dst_generate_tx_dates(state.transactions, start, end)
	))) {
		date = new Date(pf.date);
		month = date.getMonth();
		year = date.getFullYear();
		date.setDate(date.getDate() + 1);
		if(month !== date.getMonth()) {
			if(year !== date.getFullYear()) {
				date.setDate(date.getDate() - 1);
				eom(pf);
				eoy(pf);
			} else {
				date.setDate(date.getDate() - 1);
				eom(pf);
			}
		}

		if(ppf !== null) {
			cf = pf.total.basis - pf.total.realized - pf.total.closed - ppf.total.basis + ppf.total.realized + ppf.total.closed;
		}

		if(flows.length === 0) {
			/* start of month */
			if(Math.abs(pf.total.basis + pf.total.unrealized) > 1e-6) {
				flows.push([ date.getTime(), pf.total.basis + pf.total.unrealized ]);
			}
		} else if(Math.abs(cf) > 1e-6) {
			flows.push([ date.getTime(), cf ]);
		}

		if(yflows.length === 0) {
			/* start of year */
			if(Math.abs(pf.total.basis + pf.total.unrealized) > 1e-6) {
				yflows.push([ date.getTime(), pf.total.basis + pf.total.unrealized, pf.total.basis + pf.total.unrealized ]);
			}
		} else if(Math.abs(cf) > 1e-6) {
			yflows.push([ date.getTime(), cf, pf.total.basis + pf.total.unrealized ]);
		}

		ppf = pf;
	}
	eom(ppf);
	eoy(ppf);

	let tr, td;
	for(let year in irr) {
		tbody.prepend(tr = $(document.createElement('tr')));
		tr.append($(document.createElement('th')).text(year));

		for(let i = 0; i < 14; ++i) {
			tr.append($(document.createElement('td')).append(
				i in irr[year] ? dst_format_percentage_gain(irr[year][i]) : ''
			));
		}
	}

	tbody.find('tr:first-child > td > span.currency-amount').slice(-3).addClass('to-date');
};

dst_on_load(() => {
	$("div#returns")
		.on('dst-load', () => dst_get_states([ 'securities', 'accounts', 'transactions', 'prices' ]).then(state => {
			dst_regen_returns(state);
			dst_regen_returns_table(state);
		}))
		.on('dst-show', () => {
			if(dst_chart_returns_account_returns === null) return;
			dst_chart_returns_account_returns.flush();
		});

	$("form#returns-date-selector").submit(function(e) {
		e.preventDefault();
		dst_regen_returns();
	});
	$("select#main-account-selector").change(() => dst_mark_stale($("div#returns")));
	dst_on_state_change([ 'securities, accounts', 'transactions', 'prices' ], () => dst_mark_stale($("div#returns")));
});
