/*globals enyo */

enyo.kind({
	name: "ConversationItem",
	kind: "enyo.SwipeableItem",
	confirmCaption: $L("Delete"),
	layoutKind: "enyo.HFlexLayout",
	align: "start",
	published: {
		message: ""
	},
	events: {
		onError: "",
		onSelectSender: "",
		onOpenAttachment: "",
		// Fired for a SHORT right-swipe on a message (react). Left / long-right swipes still fire
		// onConfirm (delete) via the inherited SwipeableItem confirm prompt. See dragfinishHandler.
		onReact: ""
	},
	// Swipe distance bands (fraction of row width). Right swipe: short => react, long => delete.
	// Left swipe of any length => delete. See dragfinishHandler.
	reactMinPx: 45,
	deleteRatio: 0.55,
	components: [
		{name: "imageContainer", className:"conversationContactImage", components: [
			{className: "contact-image-border"},
			{name: "contactImage", kind: "Image", className: "contact-image"}
		]},
		{name: "messageContainer", flex: 1, components:[
			{name: "message", components:[
				// Sender name for incoming group/channel messages (Telegram groups, Discord channels).
				// Hidden for 1:1 IMs and outgoing messages. See updateSenderName().
				{name: "senderName", className: "chat-sender-name", allowHtml: true, showing: false, onclick: "senderTapped"},
				{name: "messageText", allowHtml:true, onclick: "messageTapped"},
				{layoutKind: "HLayout", components:[
					{name: "messageTime", className: "message-time"},
					{name: "errorIcon", kind: "Image", src: "images/header-warning-icon.png", className:"erroricon", onclick: "showError"}
				]}	,
					{name: "invitationButtons", layoutKind: "HLayout", className:"accept-decline-box", components: [
						{name: "declineButton", kind: "IconButton", className: "enyo-button-negative", icon: "images/icon-decline.png", onclick: "declinedBuddy"},
						{name: "acceptButton", kind: "IconButton", className: "enyo-button-affirmative", icon: "images/icon-accept.png", onclick: "acceptedBuddy"}
					]}
			]}
		]}, 
		{name: "inviteService", kind: "InviteResponseService"}
	],
	create: function() {
		this.inherited(arguments);
		this.messageChanged();
		this.addClass("chat-balloon");
	},
	// Override SwipeableItem's finish (which fires delete on any swipe past ~35% width) to add
	// distance bands: SHORT right swipe => react (onReact); LONG right swipe or ANY left swipe =>
	// delete (the inherited confirm prompt via handleSwipe). Tiny drags snap back. this.index and
	// this.handlingDrag are set by the inherited dragstartHandler.
	dragfinishHandler: function(inSender, inEvent) {
		if (!this.handlingDrag) {
			return this.fire("ondragfinish", inEvent);
		}
		var dx = this.getDx(inEvent);
		var w = (this.getBounds && this.getBounds().width) || 0;
		var deletePx = Math.floor(w * this.deleteRatio);
		inEvent.preventClick();
		this.handlingDrag = false;
		this.resetPosition();
		if (dx <= -this.reactMinPx || dx >= deletePx) {
			this.handleSwipe();            // left swipe, or long right swipe -> delete confirm
		} else if (dx >= this.reactMinPx) {
			this.doReact(this.index);      // short right swipe -> react
		}
		return true;
	},
	messageChanged: function() {
		this.updateSenderName(this.message);
		this.updateMessageText(this.message, this.message.folder !== enyo.messaging.message.FOLDERS.OUTBOX && this.message.folder !== enyo.messaging.message.FOLDERS.INBOX);
		this.updateContactImage(this.message.personImage);
		this.updateSentReceived(this.message.folder);
		this.updateTime(this.message.localTimestamp);
		this.updateMessageStatus(this.message.status, this.message.errorCategory);
		this.updateInvite(this.message);
		this.updatePriority(this.message);
	},
	updatePriority: function(message){
		// 0 = normal priority
		// 1 = interactive
		// 2 = urgent
		// 3 = emergency
		// 4 = low priority
		if (message.priority && (message.priority === 2 || message.priority === 3)) {
			this.$.message.addClass("high-priority");
		}
	},
	updateMessageStatus: function(inStatus, errorCategory){
		if (inStatus !== "successful") {
			this.$.message.setClassName("enyo-item chat-balloon-error");
		} 
		if(errorCategory && (inStatus === enyo.messaging.message.MESSAGE_STATUS.FAILED || inStatus === enyo.messaging.message.MESSAGE_STATUS.UNDELIVERABLE)){
			this.$.errorIcon.canGenerate = true;
			this.$.errorIcon.show();
		}
		else{
			this.$.errorIcon.canGenerate = false;
		}
	},
	// Show who sent an incoming group/channel message. The transport writes the sender's display
	// name onto from.name for group messages (Telegram groups, Discord channels); 1:1 IMs and
	// outgoing messages have no per-message sender label (the conversation is already one person).
	updateSenderName: function(inMessage) {
		var isIncoming = inMessage.folder === enyo.messaging.message.FOLDERS.INBOX;
		var isGroup = !!(inMessage.channelName || inMessage.chatType === "groupchat");
		var sender = (inMessage.from && inMessage.from.name) ? inMessage.from.name : "";
		if (isIncoming && isGroup && sender) {
			// from.name may carry astral-emoji entities (&#NNNNN;) from the transport; neutralise tags
			// but keep the entities so emojify() can turn them into inline emoji images.
			var safe = String(sender).replace(/</g, "&lt;").replace(/>/g, "&gt;");
			this.$.senderName.setContent(enyo.messaging.message.emojify(safe));
			this.$.senderName.canGenerate = true;
			this.$.senderName.setShowing(true);
		} else {
			this.$.senderName.canGenerate = false;
			this.$.senderName.setShowing(false);
		}
	},
	updateMessageText: function(inMessage, skipTextIndexer) {
		var raw = inMessage.messageText || "";
		var inText = raw;
		if (enyo.messaging.message.isMMSMessage(inMessage)) {
			this.$.messageText.setContent(enyo.messaging.message.getMMSDisplayMessage());
			return;
		} else if (inMessage.folder === enyo.messaging.message.FOLDERS.INBOX) {
			inText = inText.replace(/\r|\n|\\r|\\n/g, "<br>");
		} else if (inMessage.folder === enyo.messaging.message.FOLDERS.OUTBOX) {
			// outgoing message needs to be sanitized since the incoming ones
			// are already sanitized before they are written into database.
			inText = enyo.string.escapeHtml(inText);
		}

		// Render media that Discord/Telegram/etc. deliver as URLs in the body (or a local attachment
		// file): images inline as <img>, audio/video/other as a tappable attachment chip that opens
		// in the associated app (Atlas plays ogg/opus/mp4 etc). The raw URL is stripped from the text
		// so we show "text + [image]/[chip]" instead of "text + long-url + [image]/[chip]".
		var media = this.extractMediaUrls(raw);
		var imagesHtml = "", chipsHtml = "";
		for (var i = 0; i < media.length; i++) {
			if (media[i].kind === "image") { imagesHtml += this.buildImageTag(media[i].url); }
			else { chipsHtml += this.buildAttachmentChip(media[i]); }
		}

		// Attachment send: an outgoing message can carry a local file path (the file we just sent).
		// Image files preview inline (mirroring received images); other files show as a chip.
		var localAttachmentHtml = "";
		if (inMessage.filePath) {
			if (this.isImagePath(inMessage.filePath)) {
				localAttachmentHtml = this.buildLocalImageHtml(inMessage.filePath);
			} else {
				localAttachmentHtml = this.buildAttachmentChip({
					url: inMessage.filePath, kind: this.mediaKind(inMessage.filePath),
					name: this.mediaName(inMessage.filePath)
				});
			}
		}

		// Pure-media message (body was only media URLs): show just the media, no text line.
		if (media.length > 0 && this.isOnlyMedia(raw)) {
			this.$.messageText.setContent(imagesHtml + chipsHtml + localAttachmentHtml + this.buildReactions(inMessage));
			return;
		}

		// Drop the matched media URLs from the displayed text (they're now an image/chip below).
		inText = inText.replace(this.mediaUrlRe(), "").replace(/(?:\s|<br>)+$/g, "");
		if (!skipTextIndexer) {
			inText = enyo.string.runTextIndexer(inText);
		}
		inText += imagesHtml + chipsHtml + localAttachmentHtml;
		// Render real Unicode emoji (😭 etc.) as inline images - no device font covers them,
		// so otherwise they show as tofu rectangles. Runs last so it operates on the final
		// HTML (after linkification) and messageText has allowHtml:true.
		this.$.messageText.setContent(enyo.messaging.message.emojify(inText) + this.buildReactions(inMessage));
	},
	// webOS reactions: render the message's `reactions` array (merged onto the row by the transport's
	// ReactionHandler) as small inline badges on the bubble - one per distinct emoji with a count,
	// instead of a separate "reacted with X" message. Returns "" when there are no reactions.
	buildReactions: function(inMessage) {
		var rx = inMessage && inMessage.reactions;
		if (!rx || !rx.length) { return ""; }
		var counts = {}, order = [];
		for (var i = 0; i < rx.length; i++) {
			var e = rx[i] && rx[i].emoji;
			if (!e) { continue; }
			if (counts[e] === undefined) { counts[e] = 0; order.push(e); }
			// per-sender entries ({emoji,sender}) count as 1; aggregated entries ({emoji,count}, e.g.
			// Telegram) carry the total directly.
			counts[e] += (rx[i].count > 0 ? rx[i].count : 1);
		}
		if (!order.length) { return ""; }
		var html = "";
		for (var j = 0; j < order.length; j++) {
			var em = order[j];
			// emojify each reaction so astral emoji render as inline images (no device font covers them).
			html += '<span class="reaction-badge">' + enyo.messaging.message.emojify(em) +
				(counts[em] > 1 ? '<span class="reaction-count">' + counts[em] + '</span>' : '') + '</span>';
		}
		return '<div class="message-reactions">' + html + '</div>';
	},
	// Media file extensions we recognise, by kind. Discord/Telegram URLs carry the real extension
	// in the path (before the ?signed-params), so extension matching classifies them correctly.
	_imageExt: "jpg|jpeg|png|gif|webp|bmp|avif",
	_audioExt: "mp3|m4a|aac|ogg|oga|opus|flac|wav|wma|amr",
	_videoExt: "mp4|m4v|mov|webm|ogv|wmv|3gp|mkv|ts",
	// A fresh global regex matching http(s)/file media URLs by extension (with optional query string),
	// PLUS local ".data" files: WhatsApp voice notes arrive as "file://<hash>.data" (the gowhatsapp
	// plugin does not always map the audio mimetype to an extension), so surface those as a chip too.
	mediaUrlRe: function() {
		var exts = this._imageExt + "|" + this._audioExt + "|" + this._videoExt;
		return new RegExp(
			"(?:https?|file):\\/\\/[^\\s<>\"']+?\\.(?:" + exts + ")(?:\\?[^\\s<>\"']*)?" +
			"|file:\\/\\/[^\\s<>\"']+?\\.data(?:\\?[^\\s<>\"']*)?",
			"gi");
	},
	// Pull media URLs out of a body, classified {url, kind, name}. url is un-escaped (real &).
	extractMediaUrls: function(text) {
		var re = this.mediaUrlRe(), urls = [], seen = {}, m;
		while ((m = re.exec(text)) !== null) {
			var url = m[0].replace(/&amp;/g, "&");
			if (seen[url]) { continue; }
			seen[url] = true;
			urls.push({ url: url, kind: this.mediaKind(url), name: this.mediaName(url) });
		}
		return urls;
	},
	// True when the body is only media URLs (plus whitespace) - i.e. a pure media message.
	isOnlyMedia: function(text) {
		return text.replace(this.mediaUrlRe(), "").replace(/\s|<br>|\\r|\\n|\r|\n/g, "") === "";
	},
	// Classify a URL/path by its file extension.
	mediaKind: function(url) {
		var ext = this.urlExt(url).toLowerCase();
		// WhatsApp voice notes come through with an unmapped ".data" extension - treat as audio so
		// they get the play-icon chip (until the plugin maps the mimetype to .ogg).
		if (ext === "data") { return "audio"; }
		if (new RegExp("^(?:" + this._imageExt + ")$", "i").test(ext)) { return "image"; }
		if (new RegExp("^(?:" + this._audioExt + ")$", "i").test(ext)) { return "audio"; }
		if (new RegExp("^(?:" + this._videoExt + ")$", "i").test(ext)) { return "video"; }
		return "file";
	},
	urlExt: function(url) {
		var p = String(url).split("?")[0].split("#")[0];
		var dot = p.lastIndexOf(".");
		return dot >= 0 ? p.substring(dot + 1) : "";
	},
	// Human filename for the chip label (last path segment, URL-decoded).
	mediaName: function(url) {
		var p = String(url).split("?")[0].split("#")[0];
		var slash = p.lastIndexOf("/");
		var name = slash >= 0 ? p.substring(slash + 1) : p;
		try { name = decodeURIComponent(name); } catch (e) {}
		// A bare "<hash>.<ext>" attachment (WhatsApp media with no real filename - the hash IS the
		// name) has nothing meaningful to show, so label it by kind instead of a raw hash: audio ->
		// "Voice message", video -> "Video", else a generic "Attachment". A named file (e.g. a
		// document "report.pdf") isn't pure-hash and falls through to show its real name.
		if (/^[0-9a-f]{16,}\.[a-z0-9]+$/i.test(name)) {
			if (/\.(mp4|3gp|3gpp|mov|m4v|webm|mkv|avi)$/i.test(name)) { return $L("Video"); }
			if (/\.(ogg|opus|mp3|m4a|aac|amr|wav|data)$/i.test(name)) { return $L("Voice message"); }
			return $L("Attachment");
		}
		// Legacy: a bare "<hash>.data" WhatsApp voice note that isn't pure-hash-named.
		if (/\.data$/i.test(name)) { return $L("Voice message"); }
		if (!name) { return $L("Attachment"); }
		// Cap long names (e.g. Discord filenames) so the chip stays tidy, keeping the extension.
		if (name.length > 28) {
			var dot = name.lastIndexOf(".");
			var ext = (dot > 0 && name.length - dot <= 6) ? name.substring(dot) : "";
			name = name.substring(0, 25 - ext.length) + "…" + ext;
		}
		return name;
	},
	// Inline <img> for an image URL. Local file:// images render bare; remote ones stay tappable.
	buildImageTag: function(url) {
		var u = url.replace(/"/g, "%22");
		if (u.indexOf("file://") === 0) {
			return '<br><img class="message-image" src="' + u + '"/>';
		}
		return '<br><a href="' + u + '" target="_blank"><img class="message-image" src="' + u + '"/></a>';
	},
	// A tappable attachment chip (audio/video/other). data-open carries the target; messageTapped()
	// reads it and opens it in the associated app (see ConversationList.openAttachment).
	buildAttachmentChip: function(item) {
		var open = (/^(?:https?|file):/i.test(item.url)) ? item.url : ("file://" + item.url);
		var openAttr = open.replace(/&/g, "&amp;").replace(/"/g, "%22");
		var name = enyo.string.escapeHtml(item.name);
		// Audio (voice notes) plays INLINE in the bubble via an HTML5 <audio> element (the app webview
		// is a file:// origin, same-origin as the local note, and the system pipeline now has Opus).
		// The old WebKit doesn't render native <audio controls> (just a blank box), so we draw our own
		// play/pause button; messageTapped toggles the hidden <audio>. No navigation = no crash.
		// Video plays INLINE too (same media path as audio: WebKit's MediaPlayerPrivatePalm hands the
		// URI to the media server, which decodes it). libWebKitLuna's supportsType() list was binary-
		// patched to add video/webm (repurposed the dead video/x-ms-wmv slot), so WebKit's engine now
		// loads webm directly; the media server (decodebin + the vp8/vp9 gst-0.10 backport + autoplug
		// shim) typefinds the real bytes and decodes WebM/VP9. mkv rides the same video/webm type (the
		// media server sniffs the container regardless). mp4-family declares its true type -> fullscreen.
		if (item.kind === "video") {
			var vext = this.urlExt(item.url).toLowerCase();
			var vtype = /^(?:webm|mkv)$/.test(vext) ? "video/webm"
				: /^(?:3gp|3gpp)$/.test(vext) ? "video/3gpp"
				: /^(?:mov)$/.test(vext) ? "video/quicktime"
				: "video/mp4";
			return '<div class="msg-video-player" data-video-toggle="1" data-open="' + openAttr + '">' +
				'<video class="msg-video" preload="none"' +
					' onended="enyo.messaging.message.videoEnded(this)">' +
					'<source src="' + openAttr + '" type="' + vtype + '"></source>' +
				'</video>' +
				'<div class="msg-video-btn"></div></div>';
		}
		if (item.kind === "audio") {
			return '<div class="msg-audio-player">' +
				'<div class="msg-audio-btn" data-audio-toggle="1"></div>' +
				'<div class="msg-audio-body">' +
					'<div class="msg-audio-track"><div class="msg-audio-fill"></div></div>' +
					'<div class="msg-audio-time">0:00</div>' +
				'</div>' +
				'<audio class="msg-audio" preload="none"' +
					' onloadedmetadata="enyo.messaging.message.audioMeta(this)"' +
					' ontimeupdate="enyo.messaging.message.audioTime(this)"' +
					' onended="enyo.messaging.message.audioEnded(this)"' +
					' src="' + openAttr + '"></audio></div>';
		}
		return '<div class="msg-attachment" data-open="' + openAttr + '" data-kind="' + item.kind + '">' +
			'<div class="msg-attachment-icon msg-attachment-' + item.kind + '"></div>' +
			'<div class="msg-attachment-name">' + name + '</div></div>';
	},
	// Attachment send: is this local path an image we can preview inline?
	isImagePath: function(path) {
		return new RegExp("\\.(?:" + this._imageExt + ")$", "i").test(path || "");
	},
	// Attachment send: inline <img> for a local (just-sent) image file. path is an absolute device
	// path; turn it into a file:// URL for the WebKit <img> src.
	buildLocalImageHtml: function(path) {
		var url = (path.indexOf("file://") === 0) ? path : ("file://" + path);
		url = url.replace(/"/g, "%22");
		return '<br><img class="message-image" src="' + url + '"/>';
	},
	// Tap on the message body. If an attachment chip OR a link (<a href>) was hit, open its target
	// via the system handler and SWALLOW the tap. Critically, we cancel the native navigation:
	// letting the message webview follow a file:// link (especially a binary .data attachment) or a
	// remote page loads it inside the app card and crashes LunaSysMgr. Plain-text taps bubble through
	// so the row context-menu (handleMessageTap) still works.
	messageTapped: function(inSender, inEvent) {
		var node = inEvent && (inEvent.target || (inEvent.domEvent && inEvent.domEvent.target));
		var root = this.hasNode();
		while (node && node !== root) {
			if (node.getAttribute) {
				var name = (node.nodeName || node.tagName || "").toUpperCase();
				// Inline video play/pause: toggle the <video> sibling; the button hides while playing.
				// Tap a video. mp4-family plays FULLSCREEN in the stock video player (media server
				// handles those); WebM/MKV plays inline (the media server can't decode those, and
				// fullscreen isn't possible in this webview - <video> renders on a hardware layer
				// behind the webview and there's no working HTML5 fullscreen API here).
				if (node.getAttribute("data-video-toggle")) {
					var vtarget = node.getAttribute("data-open");
					if (vtarget && /^(?:mp4|m4v|mov|3gp|avi)$/i.test(this.urlExt(vtarget))) {
						var de = (inEvent && inEvent.preventDefault) ? inEvent : (inEvent && inEvent.domEvent);
						if (de && de.preventDefault) { de.preventDefault(); }
						this.doOpenAttachment({ target: vtarget.replace(/&amp;/g, "&"), kind: "video" });
						return true;
					}
					var video = node.getElementsByTagName ? node.getElementsByTagName("video")[0] : null;
					if (video) {
						if (video.paused) {
							if (video.ended || (video.duration && video.currentTime >= video.duration - 0.15)) {
								try { video.currentTime = 0; } catch (e) {}
							}
							try { video.play(); } catch (e) {}
							node.className = "msg-video-player playing";
						} else {
							try { video.pause(); } catch (e) {}
							node.className = "msg-video-player";
						}
					}
					return true;
				}
				// Inline voice-note play/pause: toggle the <audio> sibling in this player box.
				if (node.getAttribute("data-audio-toggle")) {
					var box = node.parentNode;
					var audio = box && box.getElementsByTagName ? box.getElementsByTagName("audio")[0] : null;
					if (audio) {
						if (audio.paused) {
							// Replay from the start if it had finished (we leave the position at the end).
							if (audio.ended || (audio.duration && audio.currentTime >= audio.duration - 0.15)) {
								try { audio.currentTime = 0; } catch (e) {}
							}
							audio.play();
							node.className = "msg-audio-btn playing";
						} else {
							audio.pause();
							node.className = "msg-audio-btn";
						}
					}
					return true;
				}
				var target = node.getAttribute("data-open") || (name === "A" ? node.getAttribute("href") : null);
				if (target) {
					// Cancel the browser's own navigation to the href before handing off.
					var de = (inEvent && inEvent.preventDefault) ? inEvent : (inEvent && inEvent.domEvent);
					if (de && de.preventDefault) { de.preventDefault(); }
					var kind = node.getAttribute("data-kind") || this.mediaKind(target);
					this.doOpenAttachment({ target: target.replace(/&amp;/g, "&"), kind: kind });
					return true;
				}
			}
			node = node.parentNode;
		}
		return false;
	},
	updateContactImage: function(personImage) {
		this.$.contactImage.setAttribute("src", personImage);
	},
	updateTime: function(localTimestamp) {
		this.$.messageTime.setContent(this.formatTime(new Date(localTimestamp)));
	},
	formatTime: function(date){
		if (!date) {
			return "";
		}
		
		
		return Utils.formatShortTime(date);
	},
	updateSentReceived: function(inFolder) {
		if (inFolder === enyo.messaging.message.FOLDERS.INBOX) {
			this.$.message.setClassName("enyo-item chat-balloon-received");
			this.$.imageContainer.canGenerate = true; 
			this.$.imageContainer.show();
		} else if(inFolder === enyo.messaging.message.FOLDERS.OUTBOX){
			this.$.message.setClassName("enyo-item chat-balloon-sent");
			this.$.imageContainer.canGenerate = false; 
		} else {
			this.$.message.setClassName("enyo-item chat-balloon-system");
			this.$.imageContainer.canGenerate = false; 
		}
	},
	updateInvite: function(message) {
		var showInvite = this.message._kind === "com.palm.iminvitation:1" && this.message.accepted === "pending";
		
		// update invite buttons
		this.updateInviteButtons(showInvite);	
		// update style
		if (showInvite) {
			this.$.message.setClassName("enyo-item chat-balloon-error");
			this.$.imageContainer.canGenerate = false; 
		}
	},
	updateInviteButtons: function(show) {
		this.$.invitationButtons.canGenerate = show;
		this.$.invitationButtons.setShowing (show);
	},
	showError: function(inSender, inEvent){
		this.doError(this.message);
		return true;
	},
	// Tapping the sender name on a group message opens a 1:1 with that person. Bubble the click (it
	// carries the flyweight rowIndex) up to the list, and return true so the normal message-tap
	// (context menu) does not also fire.
	senderTapped: function(inSender, inEvent){
		this.doSelectSender(inEvent);
		return true;
	},
	acceptedBuddy: function(inSender, inEvent) {
		this.setResponseInvitation(true);
		return true;
	},
	declinedBuddy: function(inSender, inEvent) {
		this.setResponseInvitation(false);
		return true;
	},
	setResponseInvitation: function(accepted) {
		this.$.inviteService.responseToInvite(this.message, accepted);
	}
});