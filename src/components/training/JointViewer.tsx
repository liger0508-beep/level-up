"use client";

import React, { useEffect, useRef, useState } from "react";
import Script from "next/script";

interface JointViewerProps {
    imageUrl: string;
    targetJoints: number[];
}

export function JointViewer({ imageUrl, targetJoints }: JointViewerProps) {
    const [scriptsLoaded, setScriptsLoaded] = useState(0);
    const imageRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const detectAndDraw = async () => {
        if (!imageRef.current || !canvasRef.current || targetJoints.length === 0) return;
        // @ts-ignore
        if (!window.poseDetection || !window.poseDetection.movenet) return;
        
        try {
            // @ts-ignore
            const detectorConfig = { modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_THUNDER };
            // @ts-ignore
            const detector = await window.poseDetection.createDetector(window.poseDetection.SupportedModels.MoveNet, detectorConfig);
            
            const poses = await detector.estimatePoses(imageRef.current);
            const ctx = canvasRef.current.getContext("2d");
            
            if (ctx && poses.length > 0) {
                const img = imageRef.current;
                canvasRef.current.width = img.naturalWidth;
                canvasRef.current.height = img.naturalHeight;
                
                const keypoints = poses[0].keypoints;
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                
                const isValid = targetJoints.every((idx: number) => keypoints[idx] && keypoints[idx].score > 0.1);
                if (!isValid) return;

                const baseWidth = canvasRef.current.width;
                
                // Draw connecting lines
                ctx.beginPath();
                ctx.moveTo(keypoints[targetJoints[0]].x, keypoints[targetJoints[0]].y);
                ctx.lineTo(keypoints[targetJoints[1]].x, keypoints[targetJoints[1]].y);
                if (targetJoints.length === 3) {
                    ctx.lineTo(keypoints[targetJoints[2]].x, keypoints[targetJoints[2]].y);
                }
                ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
                ctx.lineWidth = baseWidth * 0.005;
                ctx.stroke();

                // Draw joints
                targetJoints.forEach((idx: number) => {
                    ctx.beginPath();
                    ctx.arc(keypoints[idx].x, keypoints[idx].y, baseWidth * 0.01, 0, 2 * Math.PI);
                    ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
                    ctx.fill();
                    ctx.strokeStyle = "white";
                    ctx.lineWidth = baseWidth * 0.003;
                    ctx.stroke();
                });
            }
        } catch (e) {
            console.error("Failed to detect reference pose", e);
        }
    };

    useEffect(() => {
        if (scriptsLoaded >= 2 && imageRef.current && imageRef.current.complete) {
            detectAndDraw();
        }
    }, [scriptsLoaded, imageUrl, targetJoints]);

    return (
        <>
            <Script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs" onLoad={() => setScriptsLoaded(s => s + 1)} strategy="lazyOnload" />
            {scriptsLoaded >= 1 && (
                <Script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection" onLoad={() => setScriptsLoaded(s => s + 1)} strategy="lazyOnload" />
            )}
            <div className="relative w-full h-full">
                <img 
                    ref={imageRef}
                    src={imageUrl} 
                    crossOrigin="anonymous"
                    onLoad={detectAndDraw}
                    className="w-full h-full object-contain" 
                    alt="Reference" 
                />
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none object-contain"
                />
            </div>
        </>
    );
}
