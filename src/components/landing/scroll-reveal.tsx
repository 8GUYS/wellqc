/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { motion, useReducedMotion, Variants } from "framer-motion";

export type RevealDirection = "up" | "down" | "left" | "right" | "none";

export interface ScrollRevealProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  direction?: RevealDirection;
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  once?: boolean;
  amount?: number | "some" | "all";
}

const getVariants = (
  direction: RevealDirection,
  distance: number,
  duration: number,
  delay: number
): Variants => {
  let initialX = 0;
  let initialY = 0;

  switch (direction) {
    case "up":
      initialY = distance;
      break;
    case "down":
      initialY = -distance;
      break;
    case "left":
      initialX = distance;
      break;
    case "right":
      initialX = -distance;
      break;
    case "none":
    default:
      break;
  }

  return {
    hidden: {
      opacity: 0,
      x: initialX,
      y: initialY,
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration,
        delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      },
    },
  };
};

export function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.65,
  distance = 32,
  className = "",
  once = true,
  amount = 0.2,
  ...rest
}: ScrollRevealProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }

  const variants = getVariants(direction, distance, duration, delay);

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={variants}
      className={className}
      {...(rest as any)}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  staggerChildren?: number;
  delayChildren?: number;
  className?: string;
  once?: boolean;
  amount?: number | "some" | "all";
}

export function StaggerContainer({
  children,
  staggerChildren = 0.12,
  delayChildren = 0,
  className = "",
  once = true,
  amount = 0.15,
  ...rest
}: StaggerContainerProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren,
        delayChildren,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={containerVariants}
      className={className}
      {...(rest as any)}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  direction?: RevealDirection;
  distance?: number;
  duration?: number;
  className?: string;
}

export function StaggerItem({
  children,
  direction = "up",
  distance = 28,
  duration = 0.6,
  className = "",
  ...rest
}: StaggerItemProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }

  const itemVariants = getVariants(direction, distance, duration, 0);

  return (
    <motion.div variants={itemVariants} className={className} {...(rest as any)}>
      {children}
    </motion.div>
  );
}
