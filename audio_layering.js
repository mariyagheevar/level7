/* Avian Legends layered audio engine
 * Add <script src="audio_layering.js"></script> before </body> in avian_legends_tcg.html.
 * All music is generated with Web Audio API; no external audio assets are required.
 */
(() => {
    'use strict';

    const AudioLayering = {
        ctx: null,
        master: null,
        music: null,
        enabled: true,
        muted: false,
        volume: 0.35,

        init() {
            if (this.ctx) return;
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            this.ctx = new AudioContext();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.volume;
            this.master.connect(this.ctx.destination);
            this.createControls();
            this.bindGameEvents();
        },

        resume() {
            this.init();
            if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        },

        tone(frequency, duration, type = 'sine', gain = 0.08, start = 0) {
            if (!this.ctx || this.muted) return;
            const now = this.ctx.currentTime + start;
            const oscillator = this.ctx.createOscillator();
            const envelope = this.ctx.createGain();
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, now);
            envelope.gain.setValueAtTime(0.0001, now);
            envelope.gain.exponentialRampToValueAtTime(gain, now + 0.02);
            envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
            oscillator.connect(envelope);
            envelope.connect(this.master);
            oscillator.start(now);
            oscillator.stop(now + duration + 0.03);
        },

        chord(notes, duration = 0.7, type = 'sine', gain = 0.06) {
            notes.forEach((note, index) => this.tone(note, duration, type, gain, index * 0.015));
        },

        startMusic() {
            this.resume();
            if (!this.ctx || this.music || !this.enabled) return;
            const pad = this.ctx.createOscillator();
            const bass = this.ctx.createOscillator();
            const padGain = this.ctx.createGain();
            const bassGain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            const now = this.ctx.currentTime;

            pad.type = 'triangle';
            bass.type = 'sine';
            padGain.gain.value = 0.018;
            bassGain.gain.value = 0.025;
            filter.type = 'lowpass';
            filter.frequency.value = 900;

            pad.connect(filter);
            filter.connect(padGain);
            padGain.connect(this.master);
            bass.connect(bassGain);
            bassGain.connect(this.master);

            pad.frequency.setValueAtTime(220, now);
            bass.frequency.setValueAtTime(110, now);
            pad.start(now);
            bass.start(now);
            this.music = { pad, bass, padGain, bassGain, filter };

            const progression = [220, 196, 174, 196];
            let step = 0;
            this.music.timer = window.setInterval(() => {
                if (!this.music || this.muted) return;
                const root = progression[step++ % progression.length];
                const t = this.ctx.currentTime;
                pad.frequency.exponentialRampToValueAtTime(root, t + 1.2);
                bass.frequency.exponentialRampToValueAtTime(root / 2, t + 1.2);
            }, 1200);
        },

        stopMusic() {
            if (!this.music) return;
            clearInterval(this.music.timer);
            const music = this.music;
            const now = this.ctx.currentTime;
            music.padGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
            music.bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
            window.setTimeout(() => {
                music.pad.stop();
                music.bass.stop();
            }, 300);
            this.music = null;
        },

        play(name) {
            this.resume();
            if (!this.enabled || this.muted) return;
            const sounds = {
                click: () => this.tone(620, 0.06, 'sine', 0.06),
                attack: () => {
                    this.tone(110, 0.18, 'sawtooth', 0.14);
                    this.tone(70, 0.22, 'square', 0.05, 0.04);
                },
                defend: () => this.chord([220, 330, 440], 0.28, 'triangle', 0.055),
                focus: () => this.chord([330, 440, 660], 0.35, 'sine', 0.055),
                special: () => this.chord([196, 294, 392, 587], 0.55, 'sawtooth', 0.065),
                victory: () => [392, 494, 587, 784].forEach((note, i) => this.tone(note, 0.45, 'sine', 0.08, i * 0.11)),
                defeat: () => [330, 247, 196].forEach((note, i) => this.tone(note, 0.45, 'sawtooth', 0.07, i * 0.14))
            };
            if (sounds[name]) sounds[name]();
        },

        toggleMute() {
            this.resume();
            this.muted = !this.muted;
            if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
            const button = document.getElementById('audio-toggle');
            if (button) button.innerHTML = this.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
        },

        setVolume(value) {
            this.volume = Number(value);
            if (this.master && !this.muted) this.master.gain.value = this.volume;
        },

        createControls() {
            if (document.getElementById('audio-controls')) return;
            const controls = document.createElement('div');
            controls.id = 'audio-controls';
            controls.className = 'fixed bottom-4 right-4 z-[60] flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/90 p-2 shadow-xl backdrop-blur';
            controls.innerHTML = `
                <button id="audio-toggle" title="Toggle sound" class="h-9 w-9 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700 transition">
                    <i class="fa-solid fa-volume-high"></i>
                </button>
                <button id="music-toggle" title="Toggle music" class="h-9 w-9 rounded-lg bg-slate-800 text-cyan-400 hover:bg-slate-700 transition">
                    <i class="fa-solid fa-music"></i>
                </button>
                <input id="audio-volume" aria-label="Volume" type="range" min="0" max="1" step="0.05" value="${this.volume}" class="w-20 accent-amber-400">
            `;
            document.body.appendChild(controls);
            document.getElementById('audio-toggle').onclick = () => this.toggleMute();
            document.getElementById('music-toggle').onclick = () => {
                this.resume();
                if (this.music) this.stopMusic(); else this.startMusic();
            };
            document.getElementById('audio-volume').oninput = event => this.setVolume(event.target.value);
        },

        bindGameEvents() {
            document.addEventListener('click', event => {
                const actionButton = event.target.closest('[onclick*="executeTurn"]');
                if (actionButton) {
                    const match = actionButton.getAttribute('onclick').match(/executeTurn\('(.*?)'\)/);
                    if (match) this.play(match[1]);
                }
                if (event.target.closest('[onclick*="startBattle"]')) this.startMusic();
                if (event.target.closest('[onclick*="switchTab"]') || event.target.closest('[onclick*="selectPlayerCard"]')) this.play('click');
            });

            const originalEndMatch = window.endMatch;
            if (typeof originalEndMatch === 'function') {
                window.endMatch = (...args) => {
                    this.play(args[0] ? 'victory' : 'defeat');
                    return originalEndMatch(...args);
                };
            }
        }
    };

    window.AudioLayering = AudioLayering;
    window.addEventListener('pointerdown', () => AudioLayering.resume(), { once: true });
    window.addEventListener('load', () => AudioLayering.init());
})();
