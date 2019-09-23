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

dst_on_load(() => {
	let divs = $("form.dst-date-range-selector > div.btn-group");
	divs.append.apply(divs, [
		/* XXX: refactor triggers */
		[ "5Y", function() {
			let form = $(this).closest('form');
			let d = new Date();
			form.find("input.dst-date-range-end").val(d.toISOString().split('T')[0]);
			d.setFullYear(d.getFullYear() - 5);
			form.find("input.dst-date-range-start").val(d.toISOString().split('T')[0]);
		}],
		[ "2Y", function() {
			let form = $(this).closest('form');
			let d = new Date();
			form.find("input.dst-date-range-end").val(d.toISOString().split('T')[0]);
			d.setFullYear(d.getFullYear() - 2);
			form.find("input.dst-date-range-start").val(d.toISOString().split('T')[0]);
		}],
		[ "1Y", function() {
			let form = $(this).closest('form');
			let d = new Date();
			form.find("input.dst-date-range-end").val(d.toISOString().split('T')[0]);
			d.setFullYear(d.getFullYear() - 1);
			form.find("input.dst-date-range-start").val(d.toISOString().split('T')[0]);
		}],
		[ "6M", function() {
			let form = $(this).closest('form');
			let d = new Date();
			form.find("input.dst-date-range-end").val(d.toISOString().split('T')[0]);
			d.setMonth(d.getMonth() - 6);
			form.find("input.dst-date-range-start").val(d.toISOString().split('T')[0]);
		}],
		[ "3M", function() {
			let form = $(this).closest('form');
			let d = new Date();
			form.find("input.dst-date-range-end").val(d.toISOString().split('T')[0]);
			d.setMonth(d.getMonth() - 3);
			form.find("input.dst-date-range-start").val(d.toISOString().split('T')[0]);
		}],
		[ "LY", function() {
			let form = $(this).closest('form');
			let d = new Date();
			d.setMonth(0);
			d.setDate(0);
			form.find("input.dst-date-range-end").val(d.toISOString().split('T')[0]);
			d.setFullYear(d.getFullYear() - 1);
			form.find("input.dst-date-range-start").val(d.toISOString().split('T')[0]);
		}],
		[ "YTD", function() {
			let form = $(this).closest('form');
			let d = new Date();
			form.find("input.dst-date-range-end").val(d.toISOString().split('T')[0]);
			d.setMonth(0);
			d.setDate(0);
			form.find("input.dst-date-range-start").val(d.toISOString().split('T')[0]);
		}],
		[ "LM", function() {
			let form = $(this).closest('form');
			let d = new Date();
			d.setDate(0);
			form.find("input.dst-date-range-end").val(d.toISOString().split('T')[0]);
			d.setDate(d.getDate() + 1);
			d.setMonth(d.getMonth() - 1);
			d.setDate(0);
			form.find("input.dst-date-range-start").val(d.toISOString().split('T')[0]);
		}],
		[ "MTD", function() {
			let form = $(this).closest('form');
			let d = new Date();
			form.find("input.dst-date-range-end").val(d.toISOString().split('T')[0]);
			d.setDate(0);
			form.find("input.dst-date-range-start").val(d.toISOString().split('T')[0]);
		}],
	].map(data => $(document.createElement('button')).prop('type', 'submit').addClass('btn btn-secondary btn-sm').text(data[0]).on('click', data[1])));

	divs = $("form.dst-date-selector > div.btn-group");
	divs.append.apply(divs, [
		[ "LY", function() {
			let d = new Date();
			d.setMonth(0);
			d.setDate(0);
			$(this).closest('form').find("input.dst-date").val(d.toISOString().split('T')[0]);
		}],
		[ "LM", function() {
			let d = new Date();
			d.setDate(0);
			$(this).closest('form').find("input.dst-date").val(d.toISOString().split('T')[0]);
		}],
		[ "Yesterday", function() {
			let d = new Date();
			d.setDate(d.getDate() - 1);
			$(this).closest('form').find("input.dst-date").val(dst_lte_trading_day(d).toISOString().split('T')[0]);
		}],
		[ "Today", function() {
			$(this).closest('form').find("input.dst-date").val(new Date().toISOString().split('T')[0]);
		}],
	].map(data => $(document.createElement('button')).prop('type', 'submit').addClass('btn btn-secondary btn-sm').text(data[0]).on('click', data[1])));

	let d = new Date();
	$("input.dst-date-range-end, input.dst-date").val(d.toISOString().split('T')[0]);
	d.setMonth(0);
	d.setDate(0);
	$("input.dst-date-range-start").val(d.toISOString().split('T')[0]);
});
