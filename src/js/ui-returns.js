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

const dst_regen_returns = state => {
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
	let spf = null;
	let ndays = (new Date(end).getTime() - new Date(start).getTime()) / 86400000.0;
	let inc = Math.max(1, Math.floor(ndays / 100)); /* XXX: refactor with ui-perf */

	let cx = [ 'x' ];
	let cp = [ 'positive' ];
	let cn = [ 'negative' ];
	let prevpnlpc = null, prevdate = null;

	for(let pf of dst_pf(state, filters, dst_generate_day_range(start, end, inc))) {
		if(spf === null) spf = pf;

		let pnlpc = Math.abs(pf.total.basis) > 1e-6 ?
			100.0 * (pf.total.realized + pf.total.closed + pf.total.unrealized - spf.total.realized - spf.total.closed - spf.total.unrealized) / pf.total.basis : null;

		if(prevpnlpc !== null && ((pnlpc >= 0 && prevpnlpc < 0) || (pnlpc < 0 && prevpnlpc >= 0))) {
			cx.push(dst_lerp_root(new Date(prevdate).getTime(), new Date(pf.date).getTime(), prevpnlpc, pnlpc));
			cp.push(0);
			cn.push(0);
		}
		cx.push(pf.date);
		if(pnlpc >= 0) {
			cp.push(pnlpc);
			cn.push(null);
		} else {
			cp.push(null);
			cn.push(pnlpc);
		}

		prevpnlpc = pnlpc;
		prevdate = pf.date;
	}

	dst_chart_returns_account_returns.load({
		unload: true,
		columns: [ cx, cp, cn ],
	});
};

dst_on_load(() => {
	$("div#returns")
		.on('dst-load', () => dst_get_states([ 'securities', 'accounts', 'transactions', 'prices' ]).then(dst_regen_returns))
		.on('dst-show', () => dst_chart_returns_account_returns.flush());

	$("form#returns-date-selector").submit(function(e) {
		e.preventDefault();
		dst_mark_stale($("div#returns"));
	});
	$("select#main-account-selector").change(() => dst_mark_stale($("div#returns")));
	dst_on_state_change([ 'securities, accounts', 'transactions', 'prices' ], () => dst_mark_stale($("div#returns")));
});
