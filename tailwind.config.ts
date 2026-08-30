import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				display: ['Oswald', 'sans-serif'],
				body: ['Inter', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				'xl': '12px',
				'2xl': '16px',
				'3xl': '24px'
			},
			boxShadow: {
				'elegant': '0 10px 30px -10px rgba(0, 0, 0, 0.3)',
				'3xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
			},
			backgroundImage: {
				'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'scale-in': {
					'0%': {
						transform: 'scale(0.95)',
						opacity: '0'
					},
					'100%': {
						transform: 'scale(1)',
						opacity: '1'
					}
				},
				'gradient-shift': {
					'0%': { backgroundPosition: '0% 50%' },
					'50%': { backgroundPosition: '100% 50%' },
					'100%': { backgroundPosition: '0% 50%' }
				},
				'diagonal-open': {
					'0%': {
						transform: 'scale(0.8) rotate(-1deg)',
						opacity: '0'
					},
					'100%': {
						transform: 'scale(1) rotate(0deg)',
						opacity: '1'
					}
				},
				'slide-in-from-top': {
					'0%': {
						transform: 'translateY(-100%)',
						opacity: '0'
					},
					'100%': {
						transform: 'translateY(0)',
						opacity: '1'
					}
				},
				'panel-enter-left': {
					'0%': {
						transform: 'translateX(-100%) scale(1.2)',
						opacity: '0'
					},
					'100%': {
						transform: 'translateX(0) scale(1)',
						opacity: '1'
					}
				},
			'panel-enter-right': {
				'0%': {
					transform: 'translateX(100%) scale(1.2)',
					opacity: '0'
				},
				'100%': {
					transform: 'translateX(0) scale(1)',
					opacity: '1'
				}
			},
			'stagger-fade-in': {
				'0%': {
					opacity: '0',
					transform: 'translateY(16px)'
				},
				'100%': {
					opacity: '1',
					transform: 'translateY(0)'
				}
			},
			'wiggle': {
				'0%, 100%': { transform: 'rotate(0deg)' },
				'25%': { transform: 'rotate(-6deg)' },
				'75%': { transform: 'rotate(6deg)' }
			},
			'bounce-soft': {
				'0%, 100%': { transform: 'translateY(0)' },
				'50%': { transform: 'translateY(-6px)' }
			}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'scale-in': 'scale-in 0.2s ease-out',
				'gradient-shift': 'gradient-shift 3s ease-in-out infinite',
				'diagonal-open': 'diagonal-open 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
				'slide-in-from-top': 'slide-in-from-top 0.8s ease-out',
				'panel-enter-left': 'panel-enter-left 0.9s cubic-bezier(0.22, 0.68, 0, 1.71)',
			'panel-enter-right': 'panel-enter-right 0.9s cubic-bezier(0.22, 0.68, 0, 1.71) 0.2s',
			'stagger-fade-in': 'stagger-fade-in 0.4s ease-out both'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
