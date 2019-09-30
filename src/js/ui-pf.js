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

let dst_chart_pf_pnl = null, dst_chart_pf_exposure = null;
let dst_chart_pf_exposure_type = null, dst_chart_pf_exposure_currency = null;
let dst_chart_pf_exposure_country = null, dst_chart_pf_exposure_gics = null;

const dst_log_returns = (cutoff, prices, splits) => {
	let returns = {}, s = 0.0, n = 0;
	if(typeof prices !== "object") return [ s, returns ];

	for(let k in prices) {
		if(k < cutoff) continue;

		let yday = new Date(k);
		switch(yday.getDay()) {
		case 1: yday.setDate(yday.getDate() - 3); break;
		default: yday.setDate(yday.getDate() - 1); break;
		}
		yday = yday.toISOString().split('T')[0];
		if(!(yday in prices)) continue;

		let r = Math.log(((k in splits) ? splits[k] : 1.0) * prices[k] / prices[yday]);
		returns[k] = r;
		s += r;
		++n;
	}

	return [ s / n, returns ];
};

const dst_covariance = (v1, v2, mu1, mu2) => {
	let cov = 0, n = 0;

	for(let k in v1) {
		if(!(k in v2)) continue;

		cov += (v1[k] - mu1) * (v2[k] - mu2);
		++n;
	}

	if(n < 2) return NaN;
	return cov / (n - 1) * 365.25 / 7 * 5;
};

const dst_pf_risk = (pf, state, out) => {
	let splits = {};
	state.transactions.forEach(tx => {
		if(tx.type !== 'split') return;
		if(!(tx.ticker in splits)) splits[tx.ticker] = {};
		splits[tx.ticker][tx.date] = tx.after / tx.before;
	});

	let cutoff = new Date();
	cutoff.setFullYear(cutoff.getFullYear() - 10);
	cutoff = cutoff.toISOString().split('T')[0];

	const tickers = Object.keys(pf.total.securities).filter(ticker => Math.abs(pf.total.securities[ticker].quantity) > 1e-6);
	const nt = tickers.length;
	const weights = {}, returns = {};
	tickers.forEach(tkr => {
		weights[tkr] = (pf.total.securities[tkr].basis + pf.total.securities[tkr].unrealized) / (pf.total.basis + pf.total.unrealized);
		returns[tkr] = dst_log_returns(cutoff, tkr in state.prices ? state.prices[tkr] : {}, tkr in splits ? splits[tkr] : {});
	});

	let variance = 0, t1, t2;
	for(let i = 0; i < nt; ++i) {
		t1 = tickers[i];
		if(typeof out === 'object') out[t1] = {};
		for(let j = 0; j <= i; ++j) {
			t2 = tickers[j];
			let cv = dst_covariance(returns[t1][1], returns[t2][1], returns[t1][0], returns[t2][0]);
			if(typeof out === 'object') out[t1][t2] = cv;
			variance += ((i === j) ? 1.0 : 2.0) * weights[t1] * weights[t2] * cv;
		}
	}

	return Math.exp(Math.sqrt(variance));
};

const dst_fetch_and_regen_pf_table = () => dst_get_states([ 'accounts', 'securities', 'transactions', 'prices', 'ext', 'settings' ]).then(state => {
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
	let cashpc = 100.0 * pf.total.cash.basis / (pf.total.basis + pf.total.unrealized); /* XXX: will break with mult. cash currencies */
	let showexp = false, warndate = false, exposures = {
		type: { 'Cash': cashpc },
		currency: { 'EUR': cashpc },
		country: { 'N/A': cashpc },
		gics: { 'Cash and/or Derivatives': cashpc },
	};
	let profits = [ 'profits' ];
	let losses = [ 'losses' ];
	let exp = [ 'exposure' ];
	let names = [];

	tbody.empty();
	$("dpv#pf .stale").removeClass('stale');

	for(let tkr of dst_sorted_pf_securities(pf, state.securities, state.settings)) {
		let s = pf.total.securities[tkr];
		if(Math.abs(s.quantity) < 1e-6){
			continue;
		}

		let tr, pc = 100.0 * (s.basis + s.unrealized) / (pf.total.basis + pf.total.unrealized);
		let security = state.securities[tkr];
		let pnl = s.realized + s.unrealized;
		let exposure = s.basis + s.unrealized;

		if(pnl >= 0) {
			profits.push(pnl);
			losses.push(0);
		} else {
			profits.push(0);
			losses.push(pnl);
		}
		exp.push(exposure);
		names.push(security.name.substring(0, 50));

		if(state.ext !== null && 'exposures' in state.ext && 'index' in security && security.index in state.ext.exposures) {
			security.exposures = state.ext.exposures[security.index];
			warndate = state.ext.date;
		}

		for(let etype of [ 'type', 'currency', 'country', 'gics' ]) {
			if('exposures' in security && etype in security.exposures) {
				for(let k in security.exposures[etype]) {
					if(!(k in exposures[etype])) exposures[etype][k] = 0.0;
					exposures[etype][k] += security.exposures[etype][k] * pc;
					showexp = true;
				}
			} else {
				if(!("Unknown" in exposures[etype])) exposures[etype].Unknown = 0.0;
				exposures[etype].Unknown += pc;
			}
		}

		let aid = Object.keys(pf.accounts).find(aid => tkr in pf.accounts[aid].securities && Math.abs(pf.accounts[aid].securities[tkr].quantity) > 1e-6);
		tbody.append(tr = $(document.createElement('tr')).data('account', aid).data('ticker', tkr).append(
			$(document.createElement('td')).append($(document.createElement('button')).addClass('btn btn-xs btn-primary input-transaction').text('T').prop('title', 'Input transaction for this security')),
			$(document.createElement('th')).text(tkr),
			$(document.createElement('td')).text(security.name.substring(0, 50)),
			$(document.createElement('td')).append(dst_format_fixed_amount(s.quantity, 4)),
			$(document.createElement('td')).append(dst_format_currency_amount(security.currency, s.basis / s.quantity)),
			$(document.createElement('td')).append(dst_format_currency_amount(security.currency, s.ltp)),
			$(document.createElement('td')).append(dst_format_percentage_gain(s.ltp / (s.basis / s.quantity))),
			$(document.createElement('td')).append((tkr in pfy.total.securities && pfy.total.securities[tkr].quantity > 1e-6) ? dst_format_percentage_gain(s.ltp / pfy.total.securities[tkr].ltp) : ''), /* XXX: will break at splits */
			$(document.createElement('td')).append(dst_format_currency_gain(security.currency, pnl)),
			$(document.createElement('td')).append(dst_format_currency_amount(security.currency, exposure)),
			$(document.createElement('td')).append((100.0 * exposure / (pf.total.basis + pf.total.unrealized)).toFixed(2) + '%')
		));

		tr.children('td').slice(2).addClass('text-right');

		if(s.stale) {
			tr.find('span.currency-amount').slice(1).addClass('stale');
		}
	}

	$("td#pf-total-pnl-closed").empty().append(dst_format_currency_gain('EUR', pf.total.closed)); /* XXX */

	let daypnl = pf.total.realized + pf.total.closed + pf.total.unrealized - pfy.total.realized - pfy.total.closed - pfy.total.unrealized;
	let daypnlp = 1 + daypnl / (pfy.total.basis + pfy.total.unrealized);
	$("h4#pf-day-change").empty().append(dst_format_currency_gain('EUR', daypnl)); /* XXX */
	$("h4#pf-day-change-percentage").empty().append(dst_format_percentage_gain(daypnlp));

	$("h4#pf-positions-value").empty().append(dst_format_currency_amount('EUR', pf.total.basis + pf.total.unrealized - pf.total.cash.basis)); /* XXX */
	$(".pf-total-pnl").empty().append(dst_format_currency_gain('EUR', pf.total.realized + pf.total.closed + pf.total.unrealized)); /* XXX */
	$("h4#pf-cash-available").empty().append(dst_format_currency_amount('EUR', pf.total.cash.basis)); /* XXX */
	$("h4#pf-account-value, .pf-total-exposure").empty().append(dst_format_currency_amount('EUR', pf.total.basis + pf.total.unrealized)); /* XXX */

	$("td#pf-total-pnl-cash").empty().append(dst_format_currency_gain('EUR', pf.total.cash.realized)); /* XXX */
	$("td#pf-total-exposure-cash").empty().append(dst_format_currency_amount('EUR', pf.total.cash.basis)); /* XXX */
	$("td#pf-total-exposure-percent-cash").empty().append(dst_format_percentage(1 + pf.total.cash.basis / (pf.total.basis + pf.total.unrealized)));

	if(pf.total.stale) {
		$(".pf-total-exposure, .pf-total-pnl, h4#pf-positions-value, h4#pf-account-value").find('span.currency-amount').addClass('stale');
	}
	if(pf.total.stale || pfy.total.stale) {
		$("h4#pf-day-change, h4#pf-day-change-percentage").find('span.currency-amount').addClass('stale');
	}

	/* XXX: make nice UI for this */
	let out = {}/*, tr*/;
	$("h4#pf-account-risk").empty().append(dst_format_percentage(dst_pf_risk(pf, state/*, out*/)));
	/*$("table#cov").remove();
	$("div#pf").append($(document.createElement('table')).prop('id', 'cov').addClass('table table-sm').append(tbody = $(document.createElement('tbody'))));
	tbody.append(tr = $(document.createElement('tr')).append($(document.createElement('td')).prop('colspan', 2)));
	Object.keys(out).forEach(ticker => tr.append($(document.createElement('th')).text(ticker)));
	Object.keys(out).reverse().forEach(t1 => {
		tbody.append(tr = $(document.createElement('tr')));
		tr.append($(document.createElement('th')).text(t1));
		tr.append($(document.createElement('td')).append(dst_format_percentage(Math.exp(Math.sqrt(out[t1][t1])))));
		Object.keys(out).forEach(t2 => {
			if(t2 in out[t1]) {
				let c = out[t1][t2] / Math.sqrt(out[t1][t1] * out[t2][t2]);
				tr.append($(document.createElement('td')).text(c.toFixed(2)).css({
					'background-color': 'hsla(' + (c >= 0 ? 140 : 20) + ', 80%, 25%, ' + (c*c) + ')'
				}));
			}
		});
	});*/


	if(dst_chart_pf_pnl === null) dst_generate_pf_charts();

	if(names.length > 0) {
		$("div#pf-securities").show();
		dst_chart_pf_pnl.load({
			unload: true,
			columns: [ profits, losses ],
			categories: names,
		});
		dst_chart_pf_exposure.load({
			unload: true,
			columns: [ exp ],
			categories: names,
		});
		let height = { height: Math.min(500, (names.length + 1) * 30) };
		dst_chart_pf_pnl.resize(height);
		dst_chart_pf_exposure.resize(height);
	} else {
		$("div#pf-securities").hide();
	}

	if(showexp) {
		$("div#pf-exposures").show();
		for(let edata of [
			[ 'type', dst_chart_pf_exposure_type ],
			[ 'currency', dst_chart_pf_exposure_currency ],
			[ 'country', dst_chart_pf_exposure_country ],
			[ 'gics', dst_chart_pf_exposure_gics ],
		]) {
			let data = Object.keys(exposures[edata[0]]).map(k => [ k, exposures[edata[0]][k] ]).sort((a, b) => {
				if(a[0] === 'Other') return 1;
				if(b[0] === 'Other') return -1;
				return b[1] - a[1];
			});
			if(data.length > 8 && data[data.length - 1][0] !== 'Other') {
				data.push([ 'Other', 0.0 ]) - 1;
			}
			for(let z = data.length - 2; z > 7; --z) {
				data[data.length - 1][1] += data[z][1];
			}
			data.splice(7, data.length - 8);
			edata[1].load({
				unload: true,
				columns: [ [ 'exposure' , ...data.map(d => d[1]) ] ],
				categories: data.map(d => d[0]),
			});
		}

		$("div#pf-exposures p").remove();
		if(warndate !== false) {
			$("div#pf-exposures").append(
				$(document.createElement('p')).addClass('col-12').append(
					$(document.createElement('small')).addClass('text-muted').text('*Exposure data is indicative. *As of ' + warndate + '.')
				)
			);
		}
	} else {
		$("div#pf-exposures").hide();
	}
};

const dst_generate_pf_charts = () => {
	dst_chart_pf_pnl = c3.generate({
		interaction: { enabled: false },
		transition: { duration: 0 },
		bindto: 'div#pf-pnl-graph',
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
				categories: [],
				tick: { multiline: false },
			}
		},
		legend: { show: false },
		grid: {
			x: { show: true },
			y: { show: true },
		},
	});
	dst_chart_pf_exposure = c3.generate({
		interaction: { enabled: false },
		transition: { duration: 0 },
		bindto: 'div#pf-exposure-graph',
		bar: {
			width: { ratio: .5 },
		},
		data: {
			columns: [],
			type: 'bar',
			colors: {
				'exposure': 'hsla(200, 100%, 60%, .8)',
			},
		},
		axis: {
			rotated: true,
			x: {
				type: 'category',
				categories: [],
				tick: { multiline: false },
			}
		},
		legend: { show: false },
		grid: {
			x: { show: true },
			y: { show: true },
		},
	});

	let opts = {
		interaction: { enabled: false },
		transition: { duration: 0 },
		size: { height: 200 },
		bar: {
			width: { ratio: .5 },
		},
		data: {
			columns: [],
			type: 'bar',
			colors: {
				exposure: 'hsla(200, 100%, 60%, .8)',
			},
		},
		axis: {
			rotated: true,
			x: {
				type: 'category',
				categories: [],
				tick: { multiline: false },
			}
		},
		legend: { show: false },
		grid: {
			x: { show: true },
			y: { show: true },
		},
	};

	opts.bindto = "div#pf-exposure-type";
	dst_chart_pf_exposure_type = c3.generate(opts);
	opts.bindto = "div#pf-exposure-currency";
	dst_chart_pf_exposure_currency = c3.generate(opts);
	opts.bindto = "div#pf-exposure-country";
	dst_chart_pf_exposure_country = c3.generate(opts);
	opts.bindto = "div#pf-exposure-gics";
	dst_chart_pf_exposure_gics = c3.generate(opts);
};

dst_on_load(() => {
	$("td#pf-total-exposure-percent").append(dst_format_percentage(2));
	$("td#pf-total-exposure-closed").append(dst_format_currency_amount('EUR', 0.0)); /* XXX */
	$("td#pf-total-exposure-percent-closed").append(dst_format_percentage(1));

	$("div#pf").on('dst-load', dst_fetch_and_regen_pf_table).on('dst-show', () => {
		dst_chart_pf_pnl.flush();
		dst_chart_pf_exposure.flush();
	});
	$("select#main-account-selector").change(() => dst_mark_stale($("div#pf")));
	$("form#pf-date-select").submit(function(e) {
		e.preventDefault();
		dst_mark_stale($("div#pf")); /* XXX: monthly P/L form doesn't have to be reloaded, possible optimization */
	});
	dst_on_state_change([ 'accounts', 'securities', 'txs', 'prices', 'ext', 'settings' ], () => dst_mark_stale($("div#pf")));
});
