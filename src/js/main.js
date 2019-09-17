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

const dst_format_currency_amount = function(ccy, amount) {
	let ret = $(document.createElement('span')).addClass('currency-amount');
	if(amount > 0) ret.addClass('currency-amount-positive');
	else if(amount < 0) {
		ret.addClass('currency-amount-negative');
		amount = -amount;
	}
	/* https://stackoverflow.com/questions/149055/how-can-i-format-numbers-as-currency-string-in-javascript */
	/* XXX */
	ret.text(amount.toLocaleString('en-GB', { style: 'currency', currency: ccy }));
	return ret;
};

$(function() {
	$("p#js-warning").remove();
});
