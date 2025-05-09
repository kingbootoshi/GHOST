import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GhostAnimatorProps {
  visible: boolean;
  size?: number;
}

/**
 * Ghost animator component that renders a simple ghost shape with animations
 * This is a fallback version that doesn't rely on external GIF files
 */
const GhostAnimator: React.FC<GhostAnimatorProps> = ({ visible, size = 300 }) => {
  // Ghost SVG path for a simple ghost shape
  const ghostPath = "M50,15 C80,15 95,30 95,50 C95,75 80,85 80,95 C80,100 85,100 85,95 C85,90 90,90 90,95 C90,100 95,100 95,95 C95,90 100,90 100,95 C100,105 90,110 80,105 C75,115 65,115 60,105 C55,115 45,115 40,105 C35,115 25,115 20,105 C10,110 0,105 0,95 C0,90 5,90 5,95 C5,100 10,100 10,95 C10,90 15,90 15,95 C15,100 20,100 20,95 C20,85 5,75 5,50 C5,30 20,15 50,15 Z";
  
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.3 }}
          style={{
            width: size,
            height: size,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: '20px'
          }}
        >
          <motion.svg
            width={size}
            height={size}
            viewBox="0 0 100 120"
            initial={{ y: 0 }}
            animate={{ 
              y: [0, -5, 0, -5, 0],
              rotate: [0, 2, 0, -2, 0]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity,
              repeatType: "loop",
              ease: "easeInOut" 
            }}
          >
            <motion.path
              d={ghostPath}
              fill="#e6e6fa"
              stroke="#6a5acd"
              strokeWidth="2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
            <motion.circle
              cx="30"
              cy="40"
              r="5"
              fill="#6a5acd"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.circle
              cx="70"
              cy="40"
              r="5"
              fill="#6a5acd"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            />
          </motion.svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GhostAnimator;