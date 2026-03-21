import { useEffect } from 'react';

interface NotificationProps {
	message: string;
	visible: boolean;
	onClose?: () => void;
	duration?: number;
}

export function AppNotification({ message, visible, onClose, duration = 4000 }: NotificationProps) {
	useEffect(() => {
		if (!visible) return;
		if (!onClose) return;
		const timer = setTimeout(onClose, duration);
		return () => clearTimeout(timer);
	}, [visible, onClose, duration]);

	if (!visible) return null;
	return (
		<div className="fixed top-6 right-6 z-50 bg-brand-600 text-white px-4 py-3 rounded-2xl shadow-lg animate-slide-up">
			<span className="font-semibold text-sm">{message}</span>
		</div>
	);
}