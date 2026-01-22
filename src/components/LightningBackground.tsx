import { useEffect, useRef, useCallback } from 'react';

interface LightningBolt {
  startX: number;
  startY: number;
  segments: { x: number; y: number }[];
  alpha: number;
  life: number;
  maxLife: number;
  width: number;
  branches: LightningBolt[];
}

export default function LightningBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const scrollRef = useRef(0);
  const boltsRef = useRef<LightningBolt[]>([]);
  const animationRef = useRef<number | null>(null);
  const lastBoltTime = useRef(0);

  const generateBolt = useCallback((
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    depth: number = 0
  ): LightningBolt => {
    const segments: { x: number; y: number }[] = [{ x: startX, y: startY }];
    const segmentCount = 8 + Math.floor(Math.random() * 8);
    const dx = (endX - startX) / segmentCount;
    const dy = (endY - startY) / segmentCount;

    for (let i = 1; i < segmentCount; i++) {
      const offsetX = (Math.random() - 0.5) * 80 * (1 - depth * 0.3);
      const offsetY = (Math.random() - 0.5) * 30;
      segments.push({
        x: startX + dx * i + offsetX,
        y: startY + dy * i + offsetY,
      });
    }
    segments.push({ x: endX, y: endY });

    const branches: LightningBolt[] = [];
    if (depth < 2 && Math.random() > 0.4) {
      const branchCount = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < branchCount; i++) {
        const branchStart = segments[Math.floor(Math.random() * (segments.length - 2)) + 1];
        const branchEndX = branchStart.x + (Math.random() - 0.5) * 150;
        const branchEndY = branchStart.y + Math.random() * 100 + 50;
        branches.push(generateBolt(branchStart.x, branchStart.y, branchEndX, branchEndY, depth + 1));
      }
    }

    return {
      startX,
      startY,
      segments,
      alpha: 1,
      life: 0,
      maxLife: 15 + Math.random() * 10,
      width: Math.max(1, 3 - depth),
      branches,
    };
  }, []);

  const spawnBolt = useCallback((targetX?: number, targetY?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const startX = Math.random() * canvas.width;
    const startY = 0;
    const endX = targetX ?? Math.random() * canvas.width;
    const endY = targetY ?? canvas.height * (0.5 + Math.random() * 0.5);

    boltsRef.current.push(generateBolt(startX, startY, endX, endY));
  }, [generateBolt]);

  const drawBolt = useCallback((ctx: CanvasRenderingContext2D, bolt: LightningBolt) => {
    if (bolt.segments.length < 2) return;

    ctx.save();
    ctx.globalAlpha = bolt.alpha;
    ctx.strokeStyle = '#F5B800';
    ctx.lineWidth = bolt.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#F5B800';
    ctx.shadowBlur = 20;

    ctx.beginPath();
    ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
    for (let i = 1; i < bolt.segments.length; i++) {
      ctx.lineTo(bolt.segments[i].x, bolt.segments[i].y);
    }
    ctx.stroke();

    // Brighter core
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#FFE066';
    ctx.lineWidth = bolt.width * 0.5;
    ctx.stroke();

    ctx.restore();

    // Draw branches
    bolt.branches.forEach((branch) => drawBolt(ctx, branch));
  }, []);

  const updateBolt = useCallback((bolt: LightningBolt): boolean => {
    bolt.life++;
    bolt.alpha = Math.max(0, 1 - bolt.life / bolt.maxLife);

    bolt.branches = bolt.branches.filter((branch) => updateBolt(branch));

    return bolt.life < bolt.maxLife;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const handleScroll = () => {
      scrollRef.current = window.scrollY;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('scroll', handleScroll);

    const animate = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background gradient
      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width * 0.8
      );
      gradient.addColorStop(0, '#0F1A2E');
      gradient.addColorStop(1, '#0A0F1C');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Ambient glow based on mouse position
      if (mouseRef.current.active) {
        const glowGradient = ctx.createRadialGradient(
          mouseRef.current.x,
          mouseRef.current.y,
          0,
          mouseRef.current.x,
          mouseRef.current.y,
          200
        );
        glowGradient.addColorStop(0, 'rgba(245, 184, 0, 0.08)');
        glowGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Auto-spawn bolts
      const scrollIntensity = Math.min(scrollRef.current / 500, 1);
      const spawnRate = 2000 - scrollIntensity * 1000; // Faster on scroll

      if (time - lastBoltTime.current > spawnRate) {
        if (mouseRef.current.active && Math.random() > 0.3) {
          // Attract to mouse
          spawnBolt(
            mouseRef.current.x + (Math.random() - 0.5) * 100,
            mouseRef.current.y + (Math.random() - 0.5) * 100
          );
        } else {
          spawnBolt();
        }
        lastBoltTime.current = time;
      }

      // Update and draw bolts
      boltsRef.current = boltsRef.current.filter((bolt) => updateBolt(bolt));
      boltsRef.current.forEach((bolt) => drawBolt(ctx, bolt));

      // Flash effect on new bolts
      if (boltsRef.current.some((b) => b.life < 2)) {
        ctx.fillStyle = 'rgba(245, 184, 0, 0.03)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    // Initial bolts
    setTimeout(() => spawnBolt(), 500);
    setTimeout(() => spawnBolt(), 1200);

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [spawnBolt, drawBolt, updateBolt]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
