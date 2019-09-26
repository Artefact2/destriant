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

const dst_fetch_ext = fetch('/destriant-ext/static.json')
	  .catch(console.error)
	  .then(r => r.json())
	  .then(ext => dst_get_state('ext').then(oldext => [ oldext, ext ]))
	  .then(exts => {
		  if(exts[0] !== null && "date" in exts[0] && exts[0].date === exts[1].date) {
			  return new Promise((resolve, reject) => resolve(exts[0]));
		  } else {
			  return dst_set_state('ext', exts[1]).then(() => dst_trigger_state_change('ext', exts[1]).then(() => exts[1]));
		  }
	  });

dst_on_load(dst_fetch_ext);
