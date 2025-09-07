'use client';

import { useEffect, useRef } from 'react';

const MAGIC_VERT_SRC = `precision mediump float; attribute vec2 position; varying vec2 uv; void main(){ uv=position; gl_Position = vec4(2.0*position-1.0,0.0,1.0); }`;
const MAGIC_FRAG_SRC = `precision mediump float; uniform vec2 resolution; uniform float time; uniform sampler2D txImage; varying vec2 uv; mat2 rot2d(float t){ return mat2(cos(t), -sin(t), sin(t), cos(t)); } mat2 scale2d(float s){ return mat2(s,0.0,0.0,s);} void main(){ vec2 initial=uv; initial.x = 0.5 - (initial.x - 0.5) * resolution.x / resolution.y; vec4 col = vec4(clamp(initial.x*1.3,0.0,1.0), clamp(initial.y*1.3,0.0,1.0), 0.6, 1.0); vec2 pos = scale2d(1.3 - 0.1 * pow(sin(time*2.0), 8.0)) * (initial - 0.5); float outer = texture2D(txImage, pos + 0.5).g; float text = texture2D(txImage, rot2d(-0.2*time) * pos + 0.5).r; float timescale = time + 0.4 * (sin(exp(cos(time*0.5))*2.0)); float tri1 = texture2D(txImage, rot2d(1.0*timescale) * pos + 0.5).b; float tri2 = texture2D(txImage, rot2d(2.0*timescale) * pos + 0.5).b; float tri3 = texture2D(txImage, rot2d(3.0*timescale) * pos + 0.5).b; gl_FragColor = col * (text + 0.7*outer + tri1 + tri2 + tri3); }`;

export default function MagicCircle({ enabled = true }: { enabled?: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const progRef = useRef<WebGLProgram | null>(null);
  const texRef = useRef<WebGLTexture | null>(null);
  const bufRef = useRef<WebGLBuffer | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return; const host = hostRef.current; if (!host) return;
    const canvas = document.createElement('canvas'); canvasRef.current = canvas; host.appendChild(canvas);
    const gl = canvas.getContext('webgl', { alpha:true, antialias:true, premultipliedAlpha:true }); if (!gl) return;
    glRef.current = gl; gl.clearColor(0,0,0,0); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    const compile = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const vs = compile(gl.VERTEX_SHADER, MAGIC_VERT_SRC); const fs = compile(gl.FRAGMENT_SHADER, MAGIC_FRAG_SRC);
    const prog = gl.createProgram()!; gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); progRef.current = prog; gl.useProgram(prog);

    const positionLoc = gl.getAttribLocation(prog, 'position');
    const resLoc = gl.getUniformLocation(prog, 'resolution');
    const timeLoc = gl.getUniformLocation(prog, 'time');
    const texLoc = gl.getUniformLocation(prog, 'txImage');

    const buffer = gl.createBuffer()!; bufRef.current = buffer; gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const quad = new Float32Array([0,0, 0,1, 1,0, 1,0, 0,1, 1,1]);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLoc); gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture()!; texRef.current = texture; const img = new window.Image(); (img as HTMLImageElement).crossOrigin='anonymous';
    img.src = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/168886/tex-magicCircle-01.png';
    img.onload = () => { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); if (texLoc) gl.uniform1i(texLoc, 0); start(); };

    const setSize = () => { const r = host.getBoundingClientRect(); const dpr = window.devicePixelRatio||1; canvas.width = Math.max(2, Math.floor(r.width*dpr)); canvas.height = Math.max(2, Math.floor(r.height*dpr)); canvas.style.width = r.width+"px"; canvas.style.height = r.height+"px"; gl.viewport(0,0,canvas.width,canvas.height); };
    let ro: ResizeObserver | undefined; if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(setSize); ro.observe(host); } else { window.addEventListener('resize', setSize); }
    setSize();

    const startTime = performance.now();
    const start = () => {
      const loop = () => { const t = (performance.now() - startTime)/1000; gl.useProgram(prog); if (resLoc) gl.uniform2f(resLoc, canvas.width, canvas.height); if (timeLoc) gl.uniform1f(timeLoc, t); gl.drawArrays(gl.TRIANGLES, 0, 6); rafRef.current = requestAnimationFrame(loop); };
      loop();
    };

    return () => { cancelAnimationFrame(rafRef.current); if (ro) ro.disconnect(); else window.removeEventListener('resize', setSize); if (texRef.current) gl.deleteTexture(texRef.current); if (bufRef.current) gl.deleteBuffer(bufRef.current); if (progRef.current) gl.deleteProgram(progRef.current); if (host.contains(canvas)) host.removeChild(canvas); };
  }, [enabled]);

  return (
    <div ref={hostRef} className="absolute left-1/2 -translate-x-1/2 bottom-3 w-[420px] h-[420px] sm:w-[520px] sm:h-[520px] pointer-events-none mix-blend-screen opacity-90 float-slower" aria-hidden/>
  );
}
