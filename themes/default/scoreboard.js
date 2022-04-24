var piio = new PiioConnector("scoreboard");

piio.on("scoreboard", data => {
	
	console.log(data);
	
});

