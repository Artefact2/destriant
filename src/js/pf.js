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

/**
  * @param state { transactions: … }
  * @param filters { before: 'Y-m-d' or null, accounts: [ id, id… ] or null, tickers: [ ticker, ticker… ] or null }
  * @param dates generator of dates (Y-m-d)
  */
const dst_pf = function*(state, filters, dates) {
	let pf = {
		total: {
			basis: 0.0,
			realized: 0.0,
			cash: { basis: 0.0, realized: 0.0 },
			securities: {},
		},
		accounts: {},
	};

	/* XXX: multi-currency shenanigans */

	if(state.securities === null) state.securities = {};
	if(state.accounts === null) state.accounts = [];
	if(state.transactions === null) state.transactions = [];
	if(state.prices === null) state.prices = {};

	if(!('before' in filters)) filters.before = null;
	if(!('accounts' in filters)) filters.accounts = null;
	if(!('tickers' in filters)) filters.tickers = null;

	let accounts = {};
	let tickers = {};
	if(filters.accounts !== null) filters.accounts.forEach(id => accounts[id] = true);
	if(filters.tickers !== null) filters.tickers.forEach(tkr => tickers[tkr] = true);

	let i = 0, imax = state.transactions.length;
	for(let date of dates) {
		while(i < imax) {
			let tx = state.transactions[i];
			if(filters.before !== null && tx.date > filters.before) break;
			if(tx.type !== 'split' && filters.accounts !== null && !(tx.account in accounts)) {
				++i;
				continue;
			}
			if(filters.tickers !== null && !(tx.ticker in tickers)) {
				++i;
				continue;
			}
			if(tx.date > date) break;

			dst_pf_apply_tx(state, pf, tx);
			++i;
		}

		if(i === imax || state.transactions[i].date > date) {
			dst_pf_compute_realized(state, pf, date);
			pf.date = date;
			yield $.extend(true, {}, pf); /* XXX: deep copy is meh */
			continue;
		}
	}
};

const dst_pf_apply_tx = (state, pf, tx) => {
	if(tx.type === 'split') {
		if(!(tx.ticker in pf.total.securities)) return;
		pf.total.securities[tx.ticker].quantity *= tx.after;
		pf.total.securities[tx.ticker].quantity /= tx.before;
		for(let a in pf.accounts) {
			if(!(tx.ticker in pf.accounts[a].securities)) continue;
			pf.accounts[a].securities[tx.ticker].quantity *= tx.after;
			pf.accounts[a].securities[tx.ticker].quantity /= tx.before;
		}
		return;
	}


	if(!(tx.account in pf.accounts)) {
		pf.accounts[tx.account] = {
			basis: 0.0,
			realized: 0.0,
			cash: { basis: 0.0, realized: 0.0 },
			securities: {},
		};
	}
	let a = pf.accounts[tx.account];

	if(tx.type === 'cash') {
		pf.total.realized -= tx.fee;
		a.realized -= tx.fee;
		pf.total.cash.realized -= tx.fee;
		a.cash.realized -= tx.fee;
		pf.total.basis += tx.quantity - tx.fee;
		a.basis += tx.quantity - tx.fee;
		pf.total.cash.basis += tx.quantity - tx.fee;
		a.cash.basis += tx.quantity - tx.fee;
		return;
	}

	console.assert(tx.type === 'security');
	if(!(tx.ticker in pf.total.securities)) {
		pf.total.securities[tx.ticker] = { quantity: 0.0, basis: 0.0, realized: 0.0 };
	}
	if(!(tx.ticker in a.securities)) {
		a.securities[tx.ticker] = { quantity: 0.0, basis: 0.0, realized: 0.0 };
	}

	let ts = pf.total.securities[tx.ticker];
	let as = a.securities[tx.ticker];
	pf.total.realized -= tx.fee;
	a.realized -= tx.fee;
	ts.realized -= tx.fee;
	as.realized -= tx.fee;
	pf.total.cash.basis -= tx.fee;
	pf.total.basis -= tx.fee;
	a.cash.basis -= tx.fee;
	a.basis -= tx.fee;

	if(Math.abs(as.quantity) < 1e-9 || as.quantity * tx.quantity >= 0) {
		/* Opening long/short position */
		ts.quantity += tx.quantity;
		as.quantity += tx.quantity;
		pf.total.cash.basis -= tx.quantity * tx.price;
		a.cash.basis -= tx.quantity * tx.price;
		ts.basis += tx.quantity * tx.price;
		as.basis += tx.quantity * tx.price;
		ts.ltp = tx.price;
		return;
	}

	/* Closing long/short position */
	let q;
	if((as.quantity + tx.quantity) * as.quantity >= 0) {
		/* Complete or partial close */
		q = tx.quantity;
	} else {
		/* Complete close + opening an opposite position */
		/* eg: buy 10, sell 20 */
		q = -as.quantity;
	}

	/* Close position */
	let realized = -q * (tx.price - as.basis / as.quantity);
	let out = -q * (as.basis / as.quantity);
	pf.total.realized += realized;
	a.realized += realized;
	ts.realized += realized;
	as.realized += realized;

	pf.total.basis -= out;
	a.basis -= out;
	ts.basis -= out;
	as.basis -= out;

	pf.total.cash.basis += realized + out;
	pf.total.basis += realized + out;
	a.cash.basis += realized + out;
	a.basis += realized + out;

	ts.quantity += tx.quantity;
	as.quantity += tx.quantity;
	q = tx.quantity - q;

	/* Maybe reopen position */
	ts.quantity += q;
	as.quantity += q;
	pf.total.cash.basis -= q * tx.price;
	a.cash.basis -= q * tx.price;
	ts.basis += q * tx.price;
	as.basis += q * tx.price;
	ts.ltp = tx.price;
};

const dst_pf_compute_realized = (state, pf, date) => {
	date = dst_lte_trading_day(date).toISOString().split('T')[0];
	pf.total.unrealized = 0.0;
	pf.total.stale = false;
	let pricemap = {};
	for(let t in pf.total.securities) {
		let s = pf.total.securities[t];

		if(Math.abs(s.quantity) < 1e-6) {
			/* XXX: edge case, we still need a price if account A is long X, and account B is short X */
			s.unrealized = 0.0;
			continue;
		}

		if(t in state.prices && date in state.prices[t]) {
			s.ltp = state.prices[t][date];
			s.stale = false;
		} else {
			s.stale = true;
			pf.total.stale = true;
			if(state.prices !== null && t in state.prices) {
				let fd = new Date(date), fdate;
				for(let i = 0; i < 2; ++i) { /* XXX */
					fd = dst_lte_trading_day(fd);
					fdate = fd.toISOString().split('T')[0];
					if(fdate in state.prices[t]) {
						s.ltp = state.prices[t][fdate];
						break;
					}
				}
			}
		}

		s.unrealized = s.quantity * s.ltp - s.basis;
		pf.total.unrealized += s.unrealized;
	}

	let accountmap = {};
	state.accounts.forEach(a => accountmap[a.id] = a);
	for(let accountid in pf.accounts) {
		let a = pf.accounts[accountid];
		let fees = accountmap[accountid].fees;
		a.unrealized = 0.0;
		a.stale = false;

		for(let t in a.securities) {
			let s = a.securities[t];
			if(Math.abs(s.quantity) < 1e-6) {
				s.unrealized = 0.0;
				continue;
			}

			s.ltp = pf.total.securities[t].ltp;
			s.stale = pf.total.securities[t].stale;
			if(s.stale) a.stale = true;
			let cc = fees[0] + fees[1] * s.quantity * s.ltp * .01 + fees[2] * s.quantity;
			s.unrealized = s.quantity * s.ltp - s.basis - cc;
			a.unrealized += s.unrealized;
			pf.total.securities[t].unrealized -= cc;
			pf.total.unrealized -= cc;
		}
	}
};

const dst_lte_trading_day = date => {
	if(typeof date === 'undefined') {
		date = new Date();
	} else if(typeof date === 'string') {
		date = new Date(date);
	}

	switch(date.getDay()) {
	case 0: /* sun */
		date.setDate(date.getDate() - 2);
		break;
	case 6: /* sat */
		date.setDate(date.getDate() - 1);
		break;
	}

	/* XXX */
	/* http://www.swingbourse.com/bourse-jours-feries.php */
	switch(date.toISOString().split('T')[0].substring(5)) {
	case '01-01':
	case '05-01':
	case '12-24':
	case '12-25':
	case '12-26':
	case '12-31':
		date.setDate(date.getDate() - 1);
		return dst_lte_trading_day(date);
	}

	/* XXX: easter? */
	return date;
};

const dst_two_consecutive_days_gen = function*(date) {
	let d = dst_lte_trading_day(date);
	yield dst_lte_trading_day(d);
	yield d;
};
