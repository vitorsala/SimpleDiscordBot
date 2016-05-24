var Discordie = require("discordie");
var ytdl = require("ytdl-core");
// var youtube = require("./youtube.js");
var vars = require('./auth.json');
var client = new Discordie();
var resources = [];
var cache = [];

client.connect({ token: vars['discordToken'] });

// Cache index
const YT_CMD = 'ytplay';
const YT_QUEUE = 'ytqueue';
const YT_CURRENTVIDEO = 'ytcurrent';
const YT_ISPLAYING = 'ytstatus';
const GG = 'gg';

client.Dispatcher.on("GATEWAY_READY", e => {
	client.Guilds.forEach(function(guild){
		console.log(guild.name + " : " + guild.id);
		cache[guild.id] = [];
		cache[guild.id][YT_QUEUE] = new Queue();
		cache[guild.id][YT_ISPLAYING] = false;
		cache[guild.id][YT_CURRENTVIDEO] = "";	
		cache[guild.id][GG] = false;

	});
	console.log("Connected as: " + client.User.username);
});

client.Dispatcher.on("MESSAGE_CREATE", e => {
	var author = e.message.author;
	var guild = e.message.guild;

	if(e.message.content == "$help"){
		e.message.reply("Comandos para o Migu Bot!\n"+
			"$ping - Verifica se eu estou recebendo comandos.  :)\n"+
			"$gg - GG!\n"+
			"$yt [link] - toca o áudio de um link do youtube, interropendo qualquer execução.\n"+
			"$ytq - Mostra o que está tocando.\n"+
			"$ytq [link] - Enfilera a música na playlist atual, caso não tenha nenhuma playlist, inicia uma.\n"+
			"$ytq list - Mostra o que está tocando, e as músicas enfilerada.\n"+
			"$ytq next - Pula para a próxima música da lista.\n"+
			"$ytq remove [index] - Remove a música do indice informado.\n"+
			"$stop - Para de tocar tudo.");
	}

	else if (e.message.content == "$ping"){
		e.message.reply("pong");
	}

	else if(e.message.content == "$gg"){
		var vChannel = author.getVoiceChannel(e.message.guild);
		if(vChannel){
			if(checkIfInVoiceChannel(vChannel,guild)){
				if(vChannel.getVoiceConnectionInfo()){
					playFile("./sfx/GG sound effect.mp3", guild.id, e.voiceConnection);	
				}
				else{
					vChannel.leave();
					cache[guild.id][GG] = true;
					vChannel.join();
				}
			}
			else{
				cache[guild.id][GG] = true;
				vChannel.join();	
			}
		}

	}

	else if(e.message.content.indexOf("$ytq") > -1){
		var arg = e.message.content.replace("$ytq","").trim();
		if(arg == ""){
			if(!cache[guild.id][YT_ISPLAYING] || cache[guild.id][YT_CURRENTVIDEO] == ""){
				e.message.reply("Não estou tocando nada no momento.  ;)");
			}
			else{
				e.message.reply("Música atual: " + cache[guild.id][YT_CURRENTVIDEO]);	
			}
		}
		else if(arg == "list"){
			if(!cache[guild.id][YT_ISPLAYING] || cache[guild.id][YT_CURRENTVIDEO] == ""){
				e.message.reply("Não estou tocando nada no momento.  ;)");
			}
			else{
				var str = "Música atual: " + cache[guild.id][YT_CURRENTVIDEO] +"\nMúsicas na fila:\n";
				var q = cache[guild.id][YT_QUEUE].getEntireQueue();
				for(var i = 0; i < q.length; i++){
					var pos = "" + (i+1);
					pos = ("00".substring(0, 2 - pos.length)) + pos;
					str += pos + ": " + q[i] + "\n";
				}
				e.message.reply(str);
			}
		}
		else if(arg.indexOf("remove ") > -1){
			var index = parseInt(arg.replace("remove ",""), 10);
			if(index){
				index -= 1;
				console.log("Tentando remover "+index)
				if(cache[guild.id][YT_QUEUE].isEmpty()){
					e.message.reply("Não tenho nenhuma música na playlist.  :(");
					return;
				}
				else if(index < 0 || index >= cache[guild.id][YT_QUEUE].getLength()){
					e.message.reply("Item não existe!");
					return;
				}
				cache[guild.id][YT_QUEUE].removePosition(index);
			}
		}
		else if(arg == "next"){
			var vChannel = author.getVoiceChannel(e.message.guild);
			if(checkIfInVoiceChannel(vChannel,guild) && cache[guild.id][YT_ISPLAYING] && !cache[guild.id][YT_QUEUE].isEmpty()){
				if(!vChannel.getVoiceConnectionInfo())	return console.log("Deu ruim com o Voice Info.");
				playRemote(cache[guild.id][YT_QUEUE].dequeue(), guild.id, vChannel.getVoiceConnectionInfo().voiceConnection);
				return;
			}
			else{
				e.message.reply("Não tenho nenhuma música na playlist.  :(");
			}

		}
		else{
			var vChannel = author.getVoiceChannel(e.message.guild);
			if(vChannel){
				if(!cache[guild.id][YT_QUEUE].isEmpty() || cache[guild.id][YT_ISPLAYING]){
					cache[guild.id][YT_QUEUE].enqueue(arg);
				}
				else{
					if(checkIfInVoiceChannel(vChannel,guild)){
						if(vChannel.getVoiceConnectionInfo()){
							playRemote(arg, guild.id, vChannel.getVoiceConnectionInfo().voiceConnection);	
						}
						else{
							vChannel.leave();
							cache[guild.id][YT_CMD] = true;
							cache[guild.id][YT_QUEUE].enqueue(arg);
							vChannel.join();
						}
					}
					else{
						cache[guild.id][YT_CMD] = true;
						cache[guild.id][YT_QUEUE].enqueue(arg);
						vChannel.join();	
					}
				}
			}
		}

	}

	else if(e.message.content.indexOf("$yt") > -1){
		var arg = e.message.content.replace("$yt","").trim();
		if(arg == ""){
			if(!cache[guild.id][YT_ISPLAYING] || cache[guild.id][YT_CURRENTVIDEO] == ""){
				e.message.reply("Não estou tocando nada no momento.  ;)");
			}
			else{
				e.message.reply("Música atual: " + cache[guild.id][YT_CURRENTVIDEO]);	
			}
		}
		else{
			var vChannel = author.getVoiceChannel(guild);
			if(vChannel){
				if(!cache[guild.id][YT_QUEUE].isEmpty()){
					cache[guild.id][YT_QUEUE].clearQueue();
				}
				if(checkIfInVoiceChannel(vChannel,guild)){
					if(vChannel.getVoiceConnectionInfo()){
						playRemote(arg, guild.id, vChannel.getVoiceConnectionInfo().voiceConnection);	
					}
					else{
						vChannel.leave();
						cache[guild.id][YT_CMD] = true;
						cache[guild.id][YT_QUEUE].enqueue(arg);
						vChannel.join();
					}
				}
				else{
					cache[guild.id][YT_CMD] = true;
					cache[guild.id][YT_QUEUE].enqueue(arg);
					vChannel.join();
				}
			}
		}
	}

	else if(e.message.content == "$stop"){
	    client.Channels.voiceForGuild(guild)
		    .filter(channel => channel.joined)
		    .forEach(channel => channel.leave());
	}

	else if(vars['admin'] == author.id){
		if(e.message.content == "$shutdown"){
			client.disconnect();
		}
	}

	else if(e.message.content.charAt(0) == "$"){
		e.message.reply("Comando inválido.\nUse '$help' para ver os comandos disponível.  :)");
	}
});

client.Dispatcher.on("VOICE_CONNECTED", e => {
	var guild = e.voiceConnection.guild;
	if(cache[guild.id][GG]){
		playFile("./sfx/GG sound effect.mp3", guild.id, e.voiceConnection);
		cache[guild.id][GG] = false;
	}
	if(cache[guild.id][YT_CMD]){
		playRemote(cache[guild.id][YT_QUEUE].dequeue(), guild.id, e.voiceConnection);
		cache[guild.id][YT_CMD] = false;
	}
});

client.Dispatcher.on("VOICE_DISCONNECTED", e => {
	var guildId = e.voiceConnection.guildId;

	cache[guildId][YT_ISPLAYING] = false;
	cache[guildId][YT_CURRENTVIDEO] = "";
	cache[guildId][YT_QUEUE].clearQueue();
});

function checkIfInVoiceChannel(vChannel, guild){
	var currentConnected = client.User.getVoiceChannel(guild);
	return (currentConnected && currentConnected.id == vChannel.id);
}

function playRemote(remote, guildId, info, callback = function(){}) {
  function onMediaInfo(err, mediaInfo) {
    if (err) return console.log("ytdl error:", err);
    // sort by bitrate, high to low; prefer webm over anything else
    var formats = mediaInfo.formats.filter(f => f.container === "webm")
    .sort((a, b) => b.audioBitrate - a.audioBitrate);

    // get first audio-only format or fallback to non-dash video
    var bestaudio = formats.find(f => f.audioBitrate > 0 && !f.bitrate) ||
                    formats.find(f => f.audioBitrate > 0);
    if (!bestaudio) return console.log("[playRemote] No valid formats");

    if (!info) return console.log("[playRemote] VoiceConnection não informado");
    // note that in this case FFmpeg must also be compiled with HTTPS support
    var encoder = info.createExternalEncoder({
      type: "ffmpeg", source: bestaudio.url
    });
	encoder.once("end", () => {
		if(cache[guildId][YT_QUEUE].isEmpty()){
			cache[guildId][YT_ISPLAYING] = false;
			cache[guildId][YT_CURRENTVIDEO] = "";
			info.disconnect();
		}else{
			playRemote(cache[guildId][YT_QUEUE].dequeue(), info);
		}
		callback();
	});
    encoder.play();
	cache[guildId][YT_CURRENTVIDEO] = remote;
    cache[guildId][YT_ISPLAYING] = true;
  }
  try {
    ytdl.getInfo(remote, onMediaInfo);
  } catch (e) { console.log("ytdl threw:", e); }
}

function playFile(name, guildId, info, callback = function(){}){
	cache[guildId][YT_ISPLAYING] = false;
	cache[guildId][YT_CURRENTVIDEO] = "";
	if (!info) return console.log("[playFile] VoiceConnection não informado");

	var encoder = info.createExternalEncoder({
		type: "ffmpeg",

		// any source FFmpeg can read (http, rtmp, etc.) (FFmpeg option '-i');
		// (with "-" source pipe data into `encoder.stdin`)
		source: name,

		// "opus" or "pcm", in "opus" mode AudioEncoder.setVolume won't work
		// - "opus" - encode audio using FFmpeg only and let node just stream opus
		// - "pcm" - request pcm data from FFmpeg and encode inside node.js
		format: "opus", // < default

		// "pcm" mode option
		frameDuration: 60, // < default

		// optional array of additional arguments (applied to input stream)
		inputArgs: [],

		// optional array of additional arguments (applied to output stream)
		// (this volume parameter is passed into FFmpeg and applied for both
		//  "pcm" and "opus" formats, but can't be changed dynamically)
		outputArgs: ["-af", "volume=0.5"],

		// optional, 'true' redirects FFmpeg's stderr into console
		//                  and starts with "-loglevel warning"
		debug: false
	});
	if (!encoder) return console.log("Voice connection is disposed");

	encoder.once("end", () => {
	cache[guildId][GG] = false;
		info.disconnect();
		callback();
	});

	var encoderStream = encoder.play();
	encoderStream.resetTimestamp();
	// encoderStream.removeAllListeners("timestamp");
	// encoderStream.on("timestamp", time => console.log("Time " + time));
}

function isAdmin(user, guild){
	for(var o in user.permissionsFor(guild)){
		for(var elem in o){
			if(!elem)	return false;
		}	
	}
	return true;
}




/*
Queue.js

A function to represent a queue

Created by Stephen Morley - http://code.stephenmorley.org/ - and released under
the terms of the CC0 1.0 Universal legal code:

http://creativecommons.org/publicdomain/zero/1.0/legalcode

*/

/* Creates a new queue. A queue is a first-in-first-out (FIFO) data structure -
 * items are added to the end of the queue and removed from the front.
 */
function Queue(){

	// initialise the queue and offset
	var queue  = [];
	var offset = 0;

	// Returns the length of the queue.
	this.getLength = function(){
		return (queue.length - offset);
	}

	// Returns true if the queue is empty, and false otherwise.
	this.isEmpty = function(){
		return (queue.length == 0);
	}

	/* Enqueues the specified item. The parameter is:
	*
	* item - the item to enqueue
	*/
	this.enqueue = function(item){
		queue.push(item);
	}

	/* Dequeues an item and returns it. If the queue is empty, the value
	* 'undefined' is returned.
	*/
	this.dequeue = function(){

		if (queue.length == 0) return undefined;

		var item = queue[offset];

		if (++ offset * 2 >= queue.length){
			queue  = queue.slice(offset);
			offset = 0;
		}

		return item;

	}

	this.peek = function(){
		return (queue.length > 0 ? queue[offset] : undefined);
	}

	// K
	this.removePosition = function(pos){
		if(queue.length == 0){
			return false;
		}
		else{
			if(offset > 0){
				queue = queue.slice(offset);
				offset = 0;
			}
			if(pos < queue.length){
				queue.splice(pos,1);
			}
			return true;
		}
	}

	this.getEntireQueue = function(){
		return queue.slice(offset);
	}

	this.clearQueue = function(){
		queue = [];
		offset = 0;
	}
}