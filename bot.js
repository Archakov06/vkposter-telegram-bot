var VK = require('vksdk');
var TelegramBot = require('node-telegram-bot-api');
var config = require('./config.js');

// Устанавливаем настройки нашего приложения, с помощью которого будут отправляться публикации.
var vk = new VK({
   'appId'     : config.vk_appId,
   'appSecret' : config.vk_secret,
   'language'  : 'ru'
});

// Через сколько часов публиковать "первую" запись (0 - сейчас).
// Этот параметр будет увеличиваться при отправке каждой публикации, смотреть ниже...
var hours = 0;

// Устанавливаем токен VK API
vk.setToken(config.vk_token);

// Включить запросы с токеном
vk.setSecureRequests(true);

// Устанавливаем токен и включаем пулл-запросы
var bot = new TelegramBot(config.tg_token, {polling: true});

// Функция получения ID группы и номера записи (Пример: -20629724_971554)
function getWallId(url){
	return url.replace(/\s*[a-zA-Z\/\/:\.]*vk.com\/wall/,'');
}

// Функция для генерации случайного числа. Применяется для рандомной публикации записи.
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Отлавливаем запрос на увеличение переменной hours (через сколько часов публиковать запись).
// К примеру, если отправить боту: "/plus 5", то время следующей публикации увеличится на +5 часов.
bot.onText(/\/plus (.+)/, function (msg, match) {
	bot.sendMessage(msg.from.id, 'Добавил +'+match[1]+' часа! Было '+hours+' часов.');
	hours += match[1];
});

// Если получили сообщение с ссылкой вида: https://vk.com/wall-20629724_971554
bot.onText(/\s*[a-zA-Z\/\/:\.]*vk.com\/wall(.+)$/, function (msg, match) {

	// Получаем ID группы и номера записи (Пример: -20629724_971554)
	var wall = getWallId(match[1]);

	// Отправляем запрос на VK API, на присланной записи. (Читайте док. VK API)
	vk.request('wall.getById', {'posts' : wall, copy_history_depth: '1'}, function(data) {

		// Пихаем JSON этой записи в переменную post
		var post = data.response[0];

		// Создаем пустой массив прикрепленных файлов
		var attachments = [];

		// Вытаскиваем все прикрепленные файлы
		for (var i = 0; i < post.attachments.length; i++){
			oid = wall[0];
			if (post.attachments[i][post.attachments[i].type].owner_id!=wall[0]) oid = post.attachments[i][post.attachments[i].type].owner_id;
			attachments.push(post.attachments[i].type+oid+'_'+post.attachments[i][post.attachments[i].type].id);
		}

		// Склеиваем все файлы в одну строку, по правилам VK API для attachments
		attachments = attachments.join(',');

		// Очищаем от хэштегов
		if (post.text.indexOf('#')>=0)
			post.text = post.text.replace(/\#(.*?)\@(\w[a-zA-Z0-9]{1,})(\s,)?/g,'');

		// Создаем unix-timestamp для отправки записи по таймеру
		// Если это не первая запись, то получаем настоящее время в unix-timestamp и прибавляем к ней количество часов из переменной hours (3600 - один час)
		var time = hours > 0 ? Math.floor(Date.now() / 1000) + ( parseFloat(hours) * 3600 ) : 0;

		// Добавляем в конце тэг(и)
		var tags = '#tag1';

		// Создаем массив со всеми вбитывами данными для отправки в VK API
		var params = {'owner_id':config.group_id, 'message' : post.text.trim()+'\n\r\n\r'+tags, 'attachments': attachments};

		// Если > 0 (не первая запись), то добавляем время публикации записи
		if (time) params.publish_date = time;

		// Отправляем запрос в VK API на публикацию данной записи.
		vk.request('wall.post', params, function(data){
			bot.sendMessage(msg.from.id, 'Запись добавлена ✅\n📢 Ссылка: https://vk.com/wall-'+config.group_id+'_'+data.response.post_id);
			hours += getRandomInt(2,5); // Случайное число от 2 до 5
		});

	});

});
