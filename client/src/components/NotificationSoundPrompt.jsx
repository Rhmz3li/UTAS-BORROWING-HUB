import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button } from 'reactstrap';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FaBell, FaVolumeUp } from 'react-icons/fa';
import {
    getNotificationSoundPreference,
    unlockNotificationSound,
    dismissNotificationSoundPrompt,
    NOTIFICATION_GESTURE_UNLOCK_EVENT,
    NOTIFICATION_AUTOPLAY_BLOCKED_EVENT
} from '../utils/playNotificationSound.js';

/**
 * Shown only if the browser blocked autoplay: we already try to play on new notifications;
 * user can mute on this device or enable + hear a sample.
 */
const NotificationSoundPrompt = () => {
    const { user } = useSelector((state) => state.auth);
    const [dismissedUi, setDismissedUi] = useState(false);
    const [autoplayBlocked, setAutoplayBlocked] = useState(false);
    const [helpHiddenAfterGesture, setHelpHiddenAfterGesture] = useState(false);

    useEffect(() => {
        if (!user) {
            setAutoplayBlocked(false);
            setHelpHiddenAfterGesture(false);
            setDismissedUi(false);
        }
    }, [user]);

    useEffect(() => {
        const onBlocked = () => setAutoplayBlocked(true);
        window.addEventListener(NOTIFICATION_AUTOPLAY_BLOCKED_EVENT, onBlocked);
        return () => window.removeEventListener(NOTIFICATION_AUTOPLAY_BLOCKED_EVENT, onBlocked);
    }, []);

    useEffect(() => {
        if (!autoplayBlocked) return undefined;
        const onGesture = () => setHelpHiddenAfterGesture(true);
        window.addEventListener(NOTIFICATION_GESTURE_UNLOCK_EVENT, onGesture);
        return () => window.removeEventListener(NOTIFICATION_GESTURE_UNLOCK_EVENT, onGesture);
    }, [autoplayBlocked]);

    const preference = useMemo(() => {
        if (typeof window === 'undefined') return 'skip';
        return getNotificationSoundPreference();
    }, [dismissedUi, user?.email]);

    const visible =
        Boolean(user) &&
        !dismissedUi &&
        preference === null &&
        autoplayBlocked &&
        !helpHiddenAfterGesture;

    const onEnable = useCallback(() => {
        unlockNotificationSound();
        setDismissedUi(true);
        toast.success('Notification sounds are on. You will hear a short chime when new alerts arrive.');
    }, []);

    const onDismiss = useCallback(() => {
        dismissNotificationSoundPrompt();
        setDismissedUi(true);
    }, []);

    if (!visible) return null;

    return (
        <div
            className="position-fixed p-3"
            style={{
                zIndex: 1080,
                maxWidth: 440,
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: '1rem',
                width: 'min(440px, calc(100vw - 2rem))'
            }}
        >
            <Alert
                color="primary"
                className="shadow-lg border-0 mb-0 rounded-4 py-3 px-3"
                style={{
                    background: 'linear-gradient(135deg, rgba(21, 101, 192, 0.95), rgba(13, 71, 161, 0.95))',
                    color: '#fff'
                }}
            >
                <div className="d-flex align-items-start gap-2">
                    <FaVolumeUp className="mt-1 flex-shrink-0" size={20} aria-hidden />
                    <div className="flex-grow-1">
                        <strong className="d-block mb-1">Notification sounds</strong>
                        <p className="small mb-3 opacity-90 mb-0" style={{ lineHeight: 1.45 }}>
                            <span className="d-block mb-1">
                                حاولنا تشغيل تنبيه صوتي تلقائياً، لكن المتصفح منع ذلك حتى تتفاعل مع الصفحة مرة
                                (نقرة أو مفتاح أو لمس)، أو يمكنك تفعيل الأصوات من الزر أدناه.
                            </span>
                            <span className="d-block">
                                We tried to play the new-notification chime automatically, but this browser blocked
                                audio until you interact once. Click or tap anywhere on the app, or use{' '}
                                <strong>Enable sounds</strong> for a sample and to save the choice.{' '}
                                <strong>No thanks</strong> mutes sounds on this device.
                            </span>
                        </p>
                        <div className="d-flex flex-wrap gap-2 justify-content-end mt-2">
                            <Button color="light" size="sm" className="rounded-pill px-3" onClick={onDismiss}>
                                No thanks
                            </Button>
                            <Button color="warning" size="sm" className="rounded-pill px-3 fw-semibold text-dark" onClick={onEnable}>
                                <FaBell className="me-1" aria-hidden />
                                Enable sounds
                            </Button>
                        </div>
                    </div>
                </div>
            </Alert>
        </div>
    );
};

export default NotificationSoundPrompt;
