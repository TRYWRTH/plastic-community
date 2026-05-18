import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-bold uppercase tracking-wider cursor-pointer transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border-2 border-foreground active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-stamp-sm hover:bg-primary/85",
        destructive: "bg-destructive text-primary-foreground shadow-stamp-sm hover:bg-destructive/85",
        outline:
          "bg-background text-foreground shadow-stamp-sm hover:bg-foreground hover:text-background",
        secondary: "bg-background text-foreground shadow-stamp-sm hover:bg-secondary",
        ghost: "border-transparent shadow-none hover:bg-foreground hover:text-background active:translate-x-0 active:translate-y-0",
        link: "border-transparent shadow-none text-foreground underline underline-offset-4 hover:opacity-70 active:translate-x-0 active:translate-y-0",
      },
      size: {
        default: "h-11 px-4 py-2 sm:h-10",
        sm: "h-10 px-3 text-xs sm:h-8",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11 sm:h-10 sm:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
