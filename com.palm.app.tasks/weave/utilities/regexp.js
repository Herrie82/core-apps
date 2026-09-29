/* Copyright 2009 Palm, Inc.  All rights reserved. */

Weave.Utilities.RegExp = 
{
	escape: function(str)
	{
		return str.replace(/[-[\]{}()*+?.\\^$|,#\s]/g, "\\$&");
	}
};
