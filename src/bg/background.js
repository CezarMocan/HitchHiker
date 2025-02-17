var USER;
var audioTracks = [];
chrome.storage.sync.get(function(syncData){
      if(!syncData.id){
        chrome.storage.sync.set({"id":new Date().getTime(), "performances": {"First Performance":{"urlList":[]}}, counter:-1, currentPerformance:"First Performance", "username":false },function(){console.log("initialized")})
      }
      chrome.storage.sync.set({"room":false, "role":false, counter:-1, "color":[Math.floor(Math.random() * 180)+75,Math.floor(Math.random() * 180)+75,Math.floor(Math.random() * 180)+75],messages:[], performanceTab: false})
      USER = syncData;
    })
chrome.storage.onChanged.addListener(function(){
  chrome.storage.sync.get(function(data){
    USER = data;
  })
})
chrome.extension.onMessage.addListener(
  function(message, sender, sendResponse) {
  	if(message.speakText){
  		speakText(message.speakText)
  	}
  	if(message.socketEvent){
  		socket.emit(message.socketEvent, message.data)
  		// if(message.socketEvent == 'newMsg'){
    //     if(!message.data.username || !message.data.color){
    //       message.data.username = USER.username;
    //       message.data.color = USER.color;
    //     }
    //     var msg = message.data.msg.trim()

  		// 	addMsg(message.data.username, msg, message.data.color)
  		// }
  	}
  	if(message.getMessages){
  		sendResponse(USER.messages)
  	}
    if(message.isGuide){
      sendResponse(USER.role == "guide")
    }
    if(message.roomJoined){
      onJoinRoom()
    }
    if(message.newPageClient){
      newPage(message.newPageClient)
    }
  });

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    //make sure this is the active tab
    if(USER.role == "guide" && tab.url.indexOf('http') >= 0 && changeInfo.url && tabId == USER.performanceTab){
      socket.emit('newPage', {url:tab.url})
      tab.title = "[HitchHiker] "+tab.title;
    }
    if(tab.url.indexOf('http') >= 0 && changeInfo.status == 'complete' && tab.active){
      console.log(chrome.runtime.getURL('src/user_created/'+USER.room+'.js'))
      chrome.tabs.executeScript(USER.performanceTab,{file:'src/user_created/'+USER.room+'.js'})
    }
});

chrome.tabs.onRemoved.addListener(function(tabId,removeInfo){
  if(tabId == USER.performanceTab){
    createNewPerformanceTab();
  }
})
// chrome.windows.create({url:"https://valley-gastonia.glitch.me/", type:"popup", state:"minimized"})
var socket = io('https://hitchhiker.glitch.me/')

socket.on('guideEvent', function(data){
  if(data.type == "topSites"){
    if(USER.role == "guide"){return false};
    chrome.topSites.get(function(sites){
      data.url=sites[data.num].url
    })
  }
  if(data.type == "playSound"){
    console.log(data.src)
    var audio = new Audio(data.src)
    audio.loop = data.loop;
    audioTracks.push(audio)
    audioTracks[audioTracks.length-1].play()
    socket.emit("status", {msg:"playSound"})
    return false;
  }
  if(data.type == "stopAudio"){
    for (var i = 0; i < audioTracks.length; i++) {
      audioTracks[i].pause();
    }
    return false
  }
  if(data.type == "deleteRecent"){
    if(audioTracks.length > 0){
      var stopAudio = audioTracks.pop()
      stopAudio.pause()
    }
    return false
  }
  messageToTab(data)
  console.log(data)
})
socket.on('toClient', function(data){
  chrome.runtime.sendMessage(data)
})
socket.on('status', function(data){
  console.log("status received")
  chrome.runtime.sendMessage(data)
})
socket.on('newPage', function(data){
	newPage(data.url)
})
socket.on('newMsg', function(data){
	addMsg(data.username, data.msg, data.color)
	//speakText(data.msg)
	chrome.runtime.sendMessage({newMsg: data})
  chrome.tabs.sendMessage(USER.performanceTab, {newMsg: data});

})
socket.on('changeText', function(data){
	console.log('message received')
	changeText(data.newText)
	speakText(data.newText)
})

socket.on('disconnect', function(){
  chrome.runtime.sendMessage({disconnected:true})
})

//functions
function changeText(str){
	messageToTab({changeText: str})
}
function messageToTab(data){
    chrome.tabs.sendMessage(USER.performanceTab, data);  
}
function newPage(newURL){
  if(!USER.performanceTab){
    createNewPerformanceTab(updatePage)
  } else {
    updatePage(newURL)
  }	
}
function updatePage(newURL){
  chrome.tabs.update(USER.performanceTab, {url:newURL, active:true}, function(tab){
      tab.title = "[HitchHiker] "+tab.title;
      socket.emit("status", {msg:"currently on "+tab.url})  
  })
  var data = {username:"server",msg:"Going to " + newURL,color:[127,127,127]}
  addMsg(data.username, data.msg, data.color)
  chrome.runtime.sendMessage({newMsg: data})
}
function createNewPerformanceTab(callback=function(){}){
  chrome.tabs.update({url:"https://hitchhiker.glitch.me/start.html", active:true},function(tab){
    USER.performanceTab = tab.id;
    sync()
    console.log("performance tab created with id " + USER.performanceTab)
    chrome.tabs.move(USER.performanceTab, {index:0})
    callback()
  })
}
function addMsg(user, msg, color){
	USER.messages.push({username:user, message:msg, color:color})
  sync()
}

function speakText(text){
  	chrome.tts.speak(text, {voiceName: "Google UK English Male", rate: 0.75})
}

 function openNewWindow(newUrl, left, top, time){
  var newTimeout = setTimeout(function(){
    if(newUrl.slice(0,4) != "http"){newUrl = "http://"+newUrl}
    chrome.windows.create({ url: newUrl, left:left, top:top, width:500, height:400 });
  }, time * 1000)
  timeouts.push(newTimeout)
}

function onJoinRoom(){
  createNewPerformanceTab(function(){
    if(USER.role == "guide")
      chrome.windows.create({type:"popup",url:chrome.extension.getURL("src/dashboard/index.html"), width:960, height:1080})
  })
}

function sync(){
  chrome.storage.sync.set(USER)
}