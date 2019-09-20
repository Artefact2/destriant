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

const dst_regen_pf_table = (state, pf) => {
	let tbody = $("div#pf tbody");
	tbody.empty();

	for(let tkr in pf.securities) {
		let s = pf.securities[tkr];
		if(Math.abs(s.quantity) < 1e-6) continue;

		tbody.append($(document.createElement('tr')).append(
			$(document.createElement('td')).append(
				$(document.createElement('strong')).text(tkr),
				', ', state.securities[tkr].name
			),
			$(document.createElement('td')).text(state.securities[tkr].currency),
			$(document.createElement('td')).addClass('text-right').append(dst_format_fixed_amount(s.quantity, 4)),
			$(document.createElement('td')).addClass('text-right').append(dst_format_currency_amount(state.securities[tkr].currency, s.basis / s.quantity)),
			$(document.createElement('td')), /* XXX */
			$(document.createElement('td')),
			$(document.createElement('td')),
			$(document.createElement('td')),
			$(document.createElement('td')),
			$(document.createElement('td'))
		));
	}

	$("th#pf-total-exposure-percent").text('100.00%');
};

dst_on_load(() => dst_get_states([ 'securities', 'transactions' ]).then(state => dst_regen_pf_table(state, dst_pf(state, {}))));
