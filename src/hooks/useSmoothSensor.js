import { useState, useEffect, useRef } from 'react';

export function useSmoothSensor(targetValue, transitionTime = 300) {
    const [displayValue, setDisplayValue] = useState(targetValue || 0);
    const animationRef = useRef(null);
    const lastTargetRef = useRef(targetValue);

    useEffect(() => {
        if (targetValue === null || targetValue === undefined) return;
        if (targetValue === lastTargetRef.current) return;

        lastTargetRef.current = targetValue;
        const startValue = displayValue;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / transitionTime, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const newValue = startValue + (targetValue - startValue) * easeProgress;

            setDisplayValue(newValue);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            }
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [targetValue, transitionTime]);

    return displayValue;
}
