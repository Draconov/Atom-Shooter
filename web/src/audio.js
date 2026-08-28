export class AudioSystem{
  constructor(){this.ctx=null;this.master=null;this.musicNodes=[];this.sfx=true;this.music=false}
  configure({sfx,music}){this.sfx=sfx;this.music=music;if(!music)this.stopMusic()}
  ensure(){if(this.ctx)return this.ctx;const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=.14;this.master.connect(this.ctx.destination);return this.ctx}
  unlock(){const c=this.ensure();if(c?.state==='suspended')c.resume();if(this.music)this.startMusic()}
  tone(freq=440,dur=.08,type='sine',vol=.2,slide=0){if(!this.sfx)return;const c=this.ensure();if(!c)return;const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),c.currentTime+dur);g.gain.setValueAtTime(vol,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+dur);o.connect(g);g.connect(this.master);o.start();o.stop(c.currentTime+dur)}
  shoot(){this.tone(820,.045,'square',.12,-220)}
  hit(){this.tone(320,.05,'triangle',.12,110)}
  collect(){this.tone(720,.09,'sine',.16,450)}
  proton(){this.tone(105,.22,'sawtooth',.22,-55)}
  explode(){this.tone(150,.5,'sawtooth',.24,-90);setTimeout(()=>this.tone(80,.35,'triangle',.14,40),70)}
  complete(){this.tone(520,.12,'sine',.16,220);setTimeout(()=>this.tone(780,.18,'sine',.14,180),130)}
  startMusic(){if(!this.music||this.musicNodes.length)return;const c=this.ensure();if(!c)return;const gain=c.createGain();gain.gain.value=.08;gain.connect(this.master);for(const [f,t] of [[55,'sine'],[82.41,'triangle']]){const o=c.createOscillator();o.type=t;o.frequency.value=f;o.connect(gain);o.start();this.musicNodes.push(o)}this.musicNodes.push(gain)}
  stopMusic(){for(const n of this.musicNodes){try{n.stop?.()}catch{ }try{n.disconnect?.()}catch{ }}this.musicNodes=[]}
}
