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

const dst_on_load = f => $(f);

const dst_format_fixed_amount = function(amount, decimals) {
	let rounded = amount.toFixed(decimals);

	if(Math.abs(parseFloat(rounded) - amount) < 1e-6) {
		return $(document.createTextNode(amount.toLocaleString('en-GB', {
			style: 'decimal',
			useGrouping: true,
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
		})));
	}

	return $(document.createElement('abbr')).prop('title', amount.toFixed(6)).text(rounded);
};

const dst_format_currency_amount = function(ccy, amount) {
	let span = $(document.createElement('span')).addClass('currency-amount');

	if(amount > 0) span.addClass('currency-amount-positive');
	else if(amount < 0) {
		span.addClass('currency-amount-negative');
		amount = -amount;
	}

	let txt = amount.toLocaleString('en-GB', {
		style: 'currency',
		currency: ccy,
	});

	if(Math.abs(parseFloat(amount.toFixed(2)) - amount) >= 1e-6) {
		span.append($(document.createElement('abbr')).addClass('rounded-figure').prop('title', amount.toFixed(6)).text(txt));
	} else {
		span.text(txt);
	}

	return span;
};

const dst_format_currency_gain = (ccy, amount) => {
	let r = dst_format_currency_amount(ccy, amount);
	if(amount > 0) r.addClass('currency-gain');
	else if(amount < 0) r.addClass('currency-loss');
	return r;
};

const dst_format_percentage = pc => {
	let sp = $(document.createElement('span')).addClass('currency-amount');
	if(pc > 1.0) sp.addClass('currency-amount-positive');
	else if(pc < 1.0) sp.addClass('currency-amount-negative');
	return sp.text((100.0 * pc - 100.0).toFixed(2) + '%');
};
const dst_format_percentage_gain = pc => {
	let sp = dst_format_percentage(pc);
	if(pc > 1.0) sp.addClass('currency-gain');
	else if(pc < 1.0) sp.addClass('currency-loss');
	return sp;
};

const dst_set_btn_spinner = btn => {
	let count = btn.data('spinner-count');
	if(typeof count !== 'number') {
		btn.data('spinner-count', 1);
	} else {
		btn.data('spinner-count', count + 1);
		return;
	}

	btn.data('spinner-text', btn.text()); /* XXX: will not work with embedded children */
	btn.width(btn.width()); /* Prevent width change when replacing the contents */
	btn.prop('disabled', true);
	btn.empty().append($(document.createElement('span')).addClass('spinner-border spinner-border-sm'));
};

const dst_unset_btn_spinner = btn => {
	let count = btn.data('spinner-count');
	if(typeof count !== 'number' || count === 0) {
		return;
	}
	if(count >= 2) {
		btn.data('spinner-count', count - 1);
		return;
	}

	btn.empty().text(btn.data('spinner-text'));
	btn.prop('disabled', false);
	btn.width('');
	btn.removeData([ 'spinner-count', 'spinner-text' ]);
};

dst_on_load((() => $("p#js-warning").remove()));
