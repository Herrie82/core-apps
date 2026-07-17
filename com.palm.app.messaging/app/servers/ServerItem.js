/*globals enyo */

// A single server (guild/network) row in the Servers tab. Shows the server display name plus its
// account type as a subtitle; tapping the row drills into its channels.
enyo.kind({
	name: "ServerItem",
	kind: "HFlexBox",
	className: "contactItem",
	align: "center",
	components: [
		{name: "serverImage", kind: "Image", className: "contact-image", src: "images/menu-icon-servers.png"},
		{kind: "VFlexBox", flex: 1, className: "message-summary", pack: "center", components: [
			{name: "displayName", className: "contact-name", allowHtml: true},
			{name: "serviceName", className: "message-preview"}
		]}
	],
	setServer: function(inServer) {
		var name = inServer.displayName || inServer.name || inServer.remoteId || $L("Server");
		this.$.displayName.setContent(enyo.messaging.message.emojifyEscaped(name));
		this.$.serviceName.setContent(enyo.string.escapeHtml(this.getServiceLabel(inServer)));
	},
	/***********************************
	 * Functions below are unit tested *
	 ***********************************/
	// Map the raw serviceName ("type_discord", "type_irc"...) to a friendly label via the account
	// template hash (same source ImStatus/getIcons use), falling back to the stripped raw name.
	getServiceLabel: function(inServer) {
		var svc = inServer.serviceName || "";
		var accountService = enyo.application && enyo.application.accountService;
		if (accountService && accountService.getMyAccountTypesHash) {
			var types = accountService.getMyAccountTypesHash();
			var tmpl = types && types[svc];
			if (tmpl && (tmpl.loc_name || tmpl.name)) {
				return tmpl.loc_name || tmpl.name;
			}
		}
		return svc.replace(/^type_/, "");
	}
});
