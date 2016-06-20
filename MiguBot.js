var Discordie = require("discordie");
var ytdl = require("ytdl-core");
var readline = require('readline');
// var youtube = require("./youtube.js");
var MCServer = require("./MCServerControl.js");
var vars = require('./auth.json');
var client = new Discordie({autoReconnect: true});
var cache = [];

client.connect({ token: vars['discordToken'] });

// Cache index
const cacheIndex = {
	YT_CMD : 'ytplay',
	YT_QUEUE : 'ytqueue',
	YT_CURRENTVIDEO : 'ytcurrent',
	YT_ISPLAYING : 'ytstatus',
	GG : 'gg'
};

const vChannelCheckCode = {
	OK : 0,
	BOT_NOT_CONNECTED : 1,
	USER_NOT_CONNECTED : 2,
	DIFFERENT_VCHANNEL : 3
};

// Discordie events
client.Dispatcher.on("GATEWAY_READY", e => {
	var op = ""
	client.Guilds.forEach(function(guild){
		// console.log(guild.name + " : " + guild.id);
		op += guild.name + " : " + guild.id + "\n";
		cache[guild.id] = [];
		cache[guild.id][cacheIndex.YT_QUEUE] = new Queue();
		cache[guild.id][cacheIndex.YT_ISPLAYING] = false;
		cache[guild.id][cacheIndex.YT_CURRENTVIDEO] = "";	
		cache[guild.id][cacheIndex.GG] = false;
	});
	client.User.setGame(vars['state']);
	op += "Connected as: " + client.User.username + "\n";
	log(op);
});

client.Dispatcher.on("GUILD_CREATE", e => {
	var guild = e.guild;
	var op = ""
	if(!cache[guild.id]){
		op += "Connected to guild " + guild.name + " : " + guild.id + "\n";
		cache[guild.id] = [];
		cache[guild.id][cacheIndex.YT_QUEUE] = new Queue();
		cache[guild.id][cacheIndex.YT_ISPLAYING] = false;
		cache[guild.id][cacheIndex.YT_CURRENTVIDEO] = "";	
		cache[guild.id][cacheIndex.GG] = false;
	}
	log(op);
});

client.Dispatcher.on("GUILD_DELETE", e => {
	// console.log(e.data);
	log("Removed from guild " + e.data.name + " : " + e.guildId);
	cache[e.guildId] = undefined;
});

client.Dispatcher.on("MESSAGE_CREATE", e => {
	// Previnir que o bot processe as próprias mensagens.
	if (e.message.author.id === client.User.id) return;

	var author = e.message.author;
	var vChannel = author.getVoiceChannel(e.message.guild);
	var guild = e.message.guild;
	var cmd = e.message.content.trim();

	if(cmd.indexOf("(╯°□°）╯︵ ┻━┻") > -1) {
		var tChannel = e.message.channel;
		tChannel.sendMessage("┬─┬﻿ ノ( ゜-゜ノ)");
	}

	if(cmd == "$help"){
		var replyMsg = "Comandos para o Migu Bot!\n"+
			"$ping - Verifica se eu estou recebendo comandos.  :)\n"+
			"$gg - GG!\n"+
			"$yt [link] - toca o áudio de um link do youtube, interropendo qualquer execução.\n"+
			"$ytq - Mostra o que está tocando.\n"+
			"$ytq [link] - Enfilera a música na playlist atual, caso não tenha nenhuma playlist, inicia uma.\n"+
			"$ytq list - Mostra o que está tocando, e as músicas enfilerada.\n"+
			"$ytq next - Pula para a próxima música da lista.\n"+
			"$ytq remove [index] - Remove a música do indice informado.\n"+
			"$stop - Para de tocar tudo."

		if(vars["mineControl"].filter(id => id == author.id).length > 0){
			replyMsg += "\n$mine [start | stop | restart | status] - Comandos para o servidor de Minecraft."
		}

		e.message.reply(replyMsg);
	}

	else if (cmd == "$ping"){
		e.message.reply("pong");
	}

	else if(cmd == "$gg"){
		if(vChannel){
			if(checkIfInVoiceChannel(vChannel,guild)){
				if(vChannel.getVoiceConnectionInfo()){
					playFile("./sfx/GG sound effect.mp3", guild.id, e.voiceConnection);	
				}
				else{
					vChannel.leave();
					cache[guild.id][cacheIndex.GG] = true;
					vChannel.join();
				}
			}
			else{
				cache[guild.id][cacheIndex.GG] = true;
				vChannel.join();	
			}
		}

	}

	else if(cmd.split(" ")[0] == "$ytq"){
		var arg = cmd.replace("$ytq","").trim();
		if(arg == ""){
			if(!cache[guild.id][cacheIndex.YT_ISPLAYING] || cache[guild.id][cacheIndex.YT_CURRENTVIDEO] == ""){
				e.message.reply("Não estou tocando nada no momento.  ;)");
			}
			else{
				e.message.reply("Música atual: " + 
					cache[guild.id][cacheIndex.YT_CURRENTVIDEO] + 
					(vChannel.joined ? "." : ". Tocando no canal " + client.User.getVoiceChannel(guild).name));	
			}
		}
		else if(arg == "list"){
			if(vChannel.joined){
				if(!cache[guild.id][cacheIndex.YT_ISPLAYING] || cache[guild.id][cacheIndex.YT_CURRENTVIDEO] == ""){
					e.message.reply("Não estou tocando nada no momento.  ;)");
				}
				else{
					var str = "Música atual: " + cache[guild.id][cacheIndex.YT_CURRENTVIDEO] +"\nMúsicas na fila:\n";
					var q = cache[guild.id][cacheIndex.YT_QUEUE].getEntireQueue();
					for(var i = 0; i < q.length; i++){
						var pos = "" + (i+1);
						pos = ("00".substring(0, 2 - pos.length)) + pos;
						str += pos + ": " + q[i] + ";\n";
					}
					e.message.reply(str);
				}
			}
		}
		else if(arg.indexOf("remove ") > -1){
			if(vChannel.joined){
				var index = parseInt(arg.replace("remove ",""), 10);
				if(index){
					index -= 1;
					// console.log("Tentando remover "+index)
					if(cache[guild.id][cacheIndex.YT_QUEUE].isEmpty()){
						e.message.reply("Não tenho nenhuma música na playlist.  :(");
						return;
					}
					else if(index < 0 || index >= cache[guild.id][cacheIndex.YT_QUEUE].getLength()){
						e.message.reply("Item não existe!");
						return;
					}
					cache[guild.id][cacheIndex.YT_QUEUE].removePosition(index);
				}
			}
		}
		else if(arg == "next"){
			if(vChannel.joined && cache[guild.id][cacheIndex.YT_ISPLAYING] && !cache[guild.id][cacheIndex.YT_QUEUE].isEmpty()){
				if(!vChannel.getVoiceConnectionInfo())	return log("Deu ruim com o Voice Info.");
				playRemote(cache[guild.id][cacheIndex.YT_QUEUE].dequeue(), guild, vChannel.getVoiceConnectionInfo().voiceConnection);
				return;
			}
			else{
				e.message.reply("Não tenho nenhuma música na playlist.  :(");
			}

		}
		else{
			if(vChannel){
				if(!cache[guild.id][cacheIndex.YT_QUEUE].isEmpty() || cache[guild.id][cacheIndex.YT_ISPLAYING]){
					cache[guild.id][cacheIndex.YT_QUEUE].enqueue(arg);
				}
				else{
					if(checkRequiredPermission(vChannel)){
						if(vChannel.joined){
							if(vChannel.getVoiceConnectionInfo()){
								playRemote(arg, guild, vChannel.getVoiceConnectionInfo().voiceConnection);	
								return;
							}
							else{
								vChannel.leave();
							}
						}
						cache[guild.id][cacheIndex.YT_CMD] = true;
						cache[guild.id][cacheIndex.YT_QUEUE].enqueue(arg);
						vChannel.join();
					}
					else{
						e.message.reply("Não tenho permissão para operar no canal que você está conectado.  :(");
					}
				}
			}
		}

	}

	else if(cmd.split(" ")[0] == "$yt"){
		var arg = cmd.replace("$yt","").trim();
		if(arg == ""){
			if(!cache[guild.id][cacheIndex.YT_ISPLAYING] || cache[guild.id][cacheIndex.YT_CURRENTVIDEO] == ""){
				e.message.reply("Não estou tocando nada no momento.  ;)");
			}
			else{
				e.message.reply("Música atual: " + 
					cache[guild.id][cacheIndex.YT_CURRENTVIDEO] + 
					(vChannel.joined ? "." : ". Tocando no canal " + client.User.getVoiceChannel(guild).name));		
			}
		}
		else{
			if(vChannel){
				if(checkRequiredPermission(vChannel)){
					cache[guild.id][cacheIndex.YT_QUEUE].clearQueue();
					if(vChannel.joined){
						if(vChannel.getVoiceConnectionInfo()){
							playRemote(arg, guild, vChannel.getVoiceConnectionInfo().voiceConnection);
							return;
						}
						else{
							vChannel.leave();
						}
					}
					cache[guild.id][cacheIndex.YT_CMD] = true;
					cache[guild.id][cacheIndex.YT_QUEUE].enqueue(arg);
					vChannel.join();
					return;
				}
				else{
					e.message.reply("Não tenho permissão para operar no canal que você está conectado.  :(");
				}
			}
		}
	}

	else if(cmd == "$stop"){
	    client.Channels.voiceForGuild(guild)
		    .filter(channel => channel.joined)
		    .forEach(channel => channel.leave());
    	log("[playRemote] End playing on guild: " + guild.name);
	}

	else if(vars["mineControl"].filter(id => id == author.id).length > 0){
		if(cmd.split(" ")[0] == "$mine"){
			var tChannel = e.message.channel;
			var arg = cmd.split(" ")[1];
			if(arg == "start"){
				if(!MCServer.isOnline()){
					tChannel.sendMessage("Iniciando o servidor dos brothers! (ip: vkawai.no-ip.org).");
					MCServer.startServer(function(){tChannel.sendMessage("Servidor iniciado com sucesso.")});
				}
				else{
					tChannel.sendMessage("Servidor já está online!");
				}
			}
			else if(arg == "stop"){
				if(MCServer.isOnline()){
					MCServer.stopServer(function(){tChannel.sendMessage("Servidor Fechado.")});
				}
				else{
					tChannel.sendMessage("Servidor já está offline!");
				}
			}
			else if(arg == "restart"){
				tChannel.sendMessage("Reiniciando o servidor.");
				MCServer.restartserver(function(){tChannel.sendMessage("Servidor reiniciado com sucesso.")});
			}
			else if(arg == "status"){
				tChannel.sendMessage("Status do servidor: " + (MCServer.isOnline() ? "ONLINE" : "OFFLINE"));
			}
		}
	}

	else if(cmd.charAt(0) == "$"){
		e.message.reply("Comando inválido.\nUse '$help' para ver os comandos disponível.  :)");
	}
	// log(vars["mineControl"].indexOf(author.id));
});

client.Dispatcher.on("VOICE_CONNECTED", e => {
	var guild = e.voiceConnection.guild;
	if(cache[guild.id][cacheIndex.GG]){
		playFile("./sfx/GG sound effect.mp3", guild.id, e.voiceConnection);
		cache[guild.id][cacheIndex.GG] = false;
	}
	if(cache[guild.id][cacheIndex.YT_CMD]){
		playRemote(cache[guild.id][cacheIndex.YT_QUEUE].dequeue(), guild, e.voiceConnection);
		cache[guild.id][cacheIndex.YT_CMD] = false;
	}
});

client.Dispatcher.on("VOICE_DISCONNECTED", e => {
	var guildId = e.voiceConnection.guildId;
	clearVoiceCache(guildId);
});

client.Dispatcher.on("DISCONNECTED", e=> {
	log("Client desconectado: "+e.error+"\n");
	if(e.autoReconnect){
		setTimeout(function(){
			client.connect({ token: vars['discordToken'] });
		},e.delay);
	}
});

function checkRequiredPermission(vChannel){
	var permissions = client.User.permissionsFor(vChannel);
	return (permissions.Voice.CONNECT && permissions.Voice.SPEAK);
}

// function checkIfInVoiceChannel(vChannel, guild){
// 	var currentConnected = client.User.getVoiceChannel(guild);
// 	return (currentConnected && currentConnected.id == vChannel.id);
// }

function clearVoiceCache(guildId){
	cache[guildId][cacheIndex.YT_ISPLAYING] = false;
	cache[guildId][cacheIndex.YT_CURRENTVIDEO] = "";
	cache[guildId][cacheIndex.YT_QUEUE].clearQueue();
}

function checkBotVoiceChannelCondition(user, guild){
	var botVC = client.User.getVoiceChannel(guild);
	var userVC = user.getVoiceChannel(guild);
	if(!botVC)	return vChannelCheckCode.BOT_NOT_CONNECTED;
	if(!userVC)	return vChannelCheckCode.USER_NOT_CONNECTED;
	if(botVC.id != userVC.id)	return vChannelCheckCode.DIFFERENT_VCHANNEL;
	return vChannelCheckCode.OK;
}

function playRemote(remote, guild, info, callback = function(){}) {
	function onMediaInfo(err, mediaInfo) {
	    if (err) return log("ytdl error:", err);
	    // sort by bitrate, high to low; prefer webm over anything else
	    var formats = mediaInfo.formats.filter(f => f.container === "webm")
	    	.sort((a, b) => b.audioBitrate - a.audioBitrate);

	    // get first audio-only format or fallback to non-dash video
	    var bestaudio = formats.find(f => f.audioBitrate > 0 && !f.bitrate) ||
	                    formats.find(f => f.audioBitrate > 0);

	    if (!bestaudio) return log("[playRemote] No valid formats");

	    if (!info) return log("[playRemote] VoiceConnection não informado");
	    // note that in this case FFmpeg must also be compiled with HTTPS support
	    var encoder = info.createExternalEncoder({
	    	type: "ffmpeg", 
			format: "opus",
	    	source: bestaudio.url, 
	    	outputArgs: ["-af", "volume=0.3"]
	    });

		encoder.once("end", () => {
			if(cache[guild.id][cacheIndex.YT_QUEUE].isEmpty()){
				cache[guild.id][cacheIndex.YT_ISPLAYING] = false;
				cache[guild.id][cacheIndex.YT_CURRENTVIDEO] = "";
	    		log("[playRemote] End playing on guild: " + guild.name);
				// client.user.getVoiceChannel(guild).leave();
				// var vconn = client.VoiceConnections.filter(vc => vc.voiceConnection.guild.id == guild.id);
				// vconn.voiceConnection.disconnect();	
			}else{
				playRemote(cache[guild.id][cacheIndex.YT_QUEUE].dequeue(), guild, info);
			}
			callback();
		});

		// encoder.once("unpipe", () =>{
		// 	log("encoder unpiped");
		// })

	    encoder.play();
	    log("[playRemote] Started playing "+remote+" on guild: " + guild.name);
		cache[guild.id][cacheIndex.YT_CURRENTVIDEO] = remote;
	    cache[guild.id][cacheIndex.YT_ISPLAYING] = true;
	}
	try {
		ytdl.getInfo(remote, onMediaInfo);
	} catch (e) { log("ytdl threw:", e); }
}

function playFile(name, guild, info, callback = function(){}){
	cache[guild.id][cacheIndex.YT_ISPLAYING] = false;
	cache[guild.id][cacheIndex.YT_CURRENTVIDEO] = "";
	if (!info) return log("[playFile] VoiceConnection não informado");
	
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
	if (!encoder) return log("Voice connection is disposed");

	encoder.once("end", () => {
	cache[guild.id][cacheIndex.GG] = false;
		client.user.getVoiceChannel(guild).leave();
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

function log(data) { // Log (dump) server output to variable
    //  Technically uneeded, useful for debugging
    // process.stdout.write(data.toString());
    console.log("==== Migu Bot Log ====\n");
    console.log(data);
    console.log("======================\n");
}

// NODE.JS EVENTS

// var stdin = process.openStdin();
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	terminal: false
});

rl.on('line', function(line){
	var cmd = line.trim();
	if(cmd === "status"){
		client.Guilds.forEach(function(guild){
			log(guild.name + ": "+(cache[guild.id][cacheIndex.YT_ISPLAYING] ? "Playing " + cache[guild.id][cacheIndex.YT_CURRENTVIDEO] : "Inativo"));
		});
	}
	else if(cmd === "list"){
		client.Guilds.forEach(function(guild){
			log(guild.name + " : " + guild.id);
		});
	}
	else if(cmd.split(" ")[0] == "stop"){
		var arg = cmd.split(" ")[1];
		if(arg == "all"){
			client.Guilds.forEach(function(guild){
				client.Channels.voiceForGuild(guild)
				    .filter(channel => channel.joined)
				    .forEach(channel => channel.leave());

				cache[guild.id] = [];
				cache[guild.id][cacheIndex.YT_QUEUE] = new Queue();
				cache[guild.id][cacheIndex.YT_ISPLAYING] = false;
				cache[guild.id][cacheIndex.YT_CURRENTVIDEO] = "";	
				cache[guild.id][cacheIndex.GG] = false;
			});	
		}
		else if(cache[arg]){
			var guild = client.Guilds.filter(guild => guild.id == arg)[0];
			if(guild){
				client.Channels.voiceForGuild(guild)
				    .filter(channel => channel.joined)
				    .forEach(channel => channel.leave());
			}
		}
	}
	else if(cmd === "shutdown"){
		client.disconnect();
		rl.close();
	}

	else if(cmd === "clear"){
		console.log('\033[2J');
	}
	
	else if(cmd[0] == '/'){
		var arg = cmd.substr(1);
		if(arg == "start"){
			if(!MCServer.isOnline()){
				log("Iniciando o servidor dos brothers! (ip: vkawai.no-ip.org).");
				MCServer.startServer();
			}
			else{
				log("Servidor já está online!");
			}
		}
		else if(arg == "stop"){
			if(MCServer.isOnline()){
				MCServer.stopServer();
			}
			else{
				log("Servidor já está offline!");
			}
		}
		else if(arg == "restart"){
			log("Reiniciando o servidor.");
			MCServer.restartserver();
		}
		else if(arg == "status"){
			log("Status do servidor: " + (MCServer.isOnline() ? "ONLINE" : "OFFLINE"));
		}
		else{
			MCServer.issueCommand();
		}
	}
	// console.log("\n");
});

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