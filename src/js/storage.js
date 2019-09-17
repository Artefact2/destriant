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

const dst_get_state = function(key) {
	return localforage.getItem(key).catch(function(err) {
		/* XXX */
		console.log(key, err);
	});
};

const dst_set_state = function(key, val) {
	return localforage.setItem(key, val).catch(function(err) {
		/* XXX */
		console.log(key, val, err);
	});
};

$(function() {
	if(!localforage.supports(localforage.INDEXEDDB)) {
		console.log('Indexed DB not supported, maximum portfolio size will be impacted');
	}
});
