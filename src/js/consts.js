/* Copyright 2019, 2020 Romain "Artefact2" Dal Maso <romain.dalmaso@artefact2.com>
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

const dst_currencies = [
	{ iso: 'EUR', symbol: '€', name: 'Euro' },
];

const dst_exchanges = [
	{ id: 'XPAR', name: 'Euronext Paris' },
	{ id: 'XAMS', name: 'Euronext Amsterdam' },
	{ id: 'XETR', name: 'XETRA' },
	{ id: 'nc', name: 'Other' },
];

const dst_fill_currency_select = function(select) {
	select.empty();
	for(let k in dst_currencies) {
		select.append(
			$(document.createElement('option'))
				.prop('value', dst_currencies[k].iso)
				.text(dst_currencies[k].iso + ', ' + dst_currencies[k].name)
		);
	}
};

const dst_fill_exchange_select = function(select) {
	select.empty();
	for(let k in dst_exchanges) {
		select.append(
			$(document.createElement('option'))
				.prop('value', dst_exchanges[k].id)
				.text(dst_exchanges[k].id + ', ' + dst_exchanges[k].name)
		);
	}
};
