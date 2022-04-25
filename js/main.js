const db = Object.freeze((() => {
	const openDb = (tableName, callback) => {
		const open = indexedDB.open('db');
		open.onupgradeneeded = function() {
			const db = open.result;
			db.createObjectStore('qna');
			db.createObjectStore('media');
		};
		open.onsuccess = function() {
			callback(open.result);
		};
		open.onerror = function() { console.error(open.error); };
	}

	const saveRecord = (tableName, file, key, callback) => {
	  openDb(tableName, function(db) {
		const tx = db.transaction(tableName, 'readwrite');
		tx.objectStore(tableName).put(file, key);
		tx.oncomplete = function() { callback(); };
		tx.onabort = function() { console.error(tx.error); };
	  });
	};

	const getRecord = (tableName, key, callback) => {
	  openDb(tableName, function(db) {
		const tx = db.transaction(tableName, 'readonly');
		const req = tx.objectStore(tableName).get(key);
		req.onsuccess = function() {
			callback(req.result);
		};
	  });
	};

	const getAllKeys = (tableName, callback) => {
		openDb(tableName, function(db) {
			const tx = db.transaction(tableName, 'readonly');
			const req = tx.objectStore(tableName).getAllKeys();
			req.onsuccess = function() {
				callback(req.result);
			};
		});
	}

	return {saveRecord, getRecord, getAllKeys};
})());

const uniqueEventsOfElements = {};

const attachUniqueEventToElement = (element, eventName, eventFunction) => {
	let events = uniqueEventsOfElements[element];
	if(!events){
		uniqueEventsOfElements[element] = events = {};
	}
	const previousFunction = events[eventName];
	if(previousFunction){
		console.log('cleaning event', element, eventName, previousFunction);
		element.removeEventListener(eventName, previousFunction);
	}
	events[eventName] = eventFunction;
	element.addEventListener(eventName, eventFunction);
};

const init = () => {
	const handleQnAUpload = (event) => {
		const fileList = event.target.files;
		if(fileList.length < 1){
			return;
		}
		const file = fileList[0];
		console.log(file);
		var reader = new FileReader();
		reader.onload = (function(key) {
			return function(e) {
				let parsedJson;
				try{
					parsedJson = JSON.parse(e.target.result);
					const values = Object.values(parsedJson);
					if(!values || !values.length){
						console.error('bad json');
						return;
					}
					const value = values[0];
					if(!value.media || !value.question || !value.answers || !value.answer){
						console.error('bad json');
						return;
					}
					db.saveRecord('qna', parsedJson, key, () => {
						console.log(key, 'uploaded');
						event.target.value = null;
						drawQnAButtons();
					});
					console.log(parsedJson);
				} catch(e){
					alert(e);
					console.error(e);
					return;
				}
			};
		})(file.name.split('.').splice(-1).join('.'));
		reader.readAsText(file);
	}

	const handleMediaUpload = (event) => {
		const fileList = event.target.files;
		let i = fileList.length;
		for(const file of fileList) {
			db.saveRecord('media', file, file.name, () => {
				console.log(file.name, 'uploaded');
				if(!--i){
					event.target.value = null;
				}
			});
		}
	}

	const availableQnAClick = (e) => {
		if(e.target.nodeName !== 'BUTTON'){
			return;
		}
		db.getRecord('qna', e.target.dataset.id, result => {
			document.getElementById('menu').style.display = 'none';
			answerQnA(result);
			document.getElementById('container').style.display = 'block';
		});
	};

	const uploadsClick = (e) => {
		if(e.target.nodeName !== 'BUTTON'){
			return;
		}
		document.getElementById(e.target.dataset.for).click();
	}

	const availableQnAEl = document.getElementById('availableQnA');
	attachUniqueEventToElement(availableQnAEl, "click", availableQnAClick);
	attachUniqueEventToElement(document.getElementById("qnaUpload"), "change", handleQnAUpload);
	attachUniqueEventToElement(document.getElementById("mediaUpload"), "change", handleMediaUpload);
	attachUniqueEventToElement(document.getElementById("uploads"), 'click', uploadsClick);

	const drawQnAButtons = () => {
		db.getAllKeys('qna', (res) => {
			while(availableQnAEl.firstChild){
				availableQnAEl.removeChild(availableQnAEl.firstChild);
			}
			res.forEach(qnaName => {
				const btn = document.createElement('button');
				btn.dataset.id = qnaName;
				btn.innerText = `Open ${qnaName} Q&A`;
				availableQnAEl.appendChild(btn);
			});
		});
	};

	drawQnAButtons();
}

const answerQnA = (_answers) => {
	const allAnswers = Object.freeze(_answers.map(value => ({ value, sort: Math.random() }))
				.sort((a, b) => a.sort - b.sort)
				.map(({ value }) => value));

	const answersCount = allAnswers.length;
	document.getElementById('answers-count').innerText = answersCount;
	const currentQEl = document.getElementById('current-q');
	const imgEl = document.getElementById('img');
	const questionEl = document.getElementById('question');
	const answersEl = document.getElementById('answers');
	const nextBtnEl = document.getElementById('next-btn');

	const displayQuestion = () => {
		const currentQuestion = allAnswers[i];
		if(!currentQuestion){
			return;
		}

		currentQEl.innerText = i + 1;

		if(imgEl.src){
			URL.revokeObjectURL(imgEl.src);
			imgEl.src = '';
		}
		while(answersEl.firstChild){
			answersEl.removeChild(answersEl.firstChild);
		}
		nextBtnEl.disabled = true;
		db.getRecord('media', currentQuestion.media, fileFromDb => {
			imgEl.src = fileFromDb ? URL.createObjectURL(fileFromDb) : currentQuestion.media;
			questionEl.innerHTML = currentQuestion.question;
			Object.entries(currentQuestion.answers)
				.map(value => ({ value, sort: Math.random() }))
				.sort((a, b) => a.sort - b.sort)
				.map(({ value }) => value)
				.forEach(answerArr => {
					const answerBtn = document.createElement('button');
					answerBtn.id = answerArr[0];
					answerBtn.innerText = answerArr[1];
					answersEl.appendChild(answerBtn);
				});
		});
	};

	let i = 0;
	attachUniqueEventToElement(nextBtnEl, 'click', () => {
		i++;
		displayQuestion();
		if(i + 1 >= answersCount){
			nextBtnEl.style.display = 'none';
		}
	});
	attachUniqueEventToElement(answersEl, 'click', (e) => {
		if(e.target.nodeName !== 'BUTTON'){
			return;
		}
		const correctAnswer = allAnswers[i].answer;
		if(e.target.id === correctAnswer){
			e.target.classList.add('correct');
		}else{
			e.target.classList.add('wrong');
			document.getElementById(correctAnswer).classList.add('correct');
		}
		answersEl.childNodes.forEach(el => {
			el.disabled = true;
			el.title = el.id;
		});
		nextBtnEl.disabled = false;
	});

	displayQuestion();
};