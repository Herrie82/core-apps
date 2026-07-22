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
		onOpenAttachment: ""
	},
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
			this.$.messageText.setContent(imagesHtml + chipsHtml + localAttachmentHtml);
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
		this.$.messageText.setContent(enyo.messaging.message.emojify(inText));
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
		// A bare "<hash>.data" (WhatsApp voice note) has no meaningful name - label it plainly.
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