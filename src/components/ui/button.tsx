import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#008037] text-white hover:bg-black active:bg-black focus:bg-black",
        destructive: "bg-[#008037] text-white hover:bg-black active:bg-black focus:bg-black",
        outline: "bg-[#008037] text-white border border-[#008037] hover:bg-black active:bg-black focus:bg-black",
        secondary: "bg-[#008037] text-white hover:bg-black active:bg-black focus:bg-black",
        ghost: "bg-[#008037] text-white hover:bg-black active:bg-black focus:bg-black",
        link: "bg-[#008037] text-white hover:bg-black active:bg-black focus:bg-black underline-offset-4",
      },
      size: {
        default: "h-10 rounded-lg px-4 py-2",
        sm: "h-10 rounded-lg px-4 py-2",
        lg: "h-10 rounded-lg px-4 py-2",
        icon: "h-10 w-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
