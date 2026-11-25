import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { defaultCaptchaSettings, type CaptchaState, type CaptchaType } from '@/lib/captcha-config';
export type { CaptchaState, CaptchaType } from '@/lib/captcha-config';

const initialState = defaultCaptchaSettings();

const captchaSlice = createSlice({
    name: 'captcha',
    initialState,
    reducers: {
        replaceCaptchaSettings: (_state, action: PayloadAction<CaptchaState>) => action.payload,
        setAllowedTypes: (state, action: PayloadAction<CaptchaType[]>) => {
            state.allowedTypes = action.payload;
        },
        setRequiredCount: (state, action: PayloadAction<number>) => {
            state.requiredCount = action.payload;
        },
        updateDateConfig: (state, action: PayloadAction<Partial<CaptchaState['dateConfig']>>) => {
            state.dateConfig = { ...state.dateConfig, ...action.payload };
        },
        updatePersonalConfig: (state, action: PayloadAction<Partial<CaptchaState['personalConfig']>>) => {
            state.personalConfig = { ...state.personalConfig, ...action.payload };
        },
        setCaptchaEnabled: (state, action: PayloadAction<boolean>) => {
            state.enabled = action.payload;
        },
        setCaptchaSettings: (state, action: PayloadAction<Partial<CaptchaState>>) => {
            const settings = action.payload;
            if (settings.allowedTypes) state.allowedTypes = settings.allowedTypes;
            if (settings.requiredCount !== undefined) state.requiredCount = settings.requiredCount;
            if (settings.dateConfig) state.dateConfig = { ...state.dateConfig, ...settings.dateConfig };
            if (settings.personalConfig) state.personalConfig = { ...state.personalConfig, ...settings.personalConfig };
            if (settings.enabled !== undefined) state.enabled = settings.enabled;
        },
    },
    extraReducers: builder => {
        builder.addMatcher(action => ['auth/logout/fulfilled', 'auth/login/pending', 'auth/login/fulfilled', 'auth/checkSession/fulfilled', 'auth/checkSession/rejected', 'auth/clearSession'].includes(action.type), () => defaultCaptchaSettings());
    },
});

export const {
    replaceCaptchaSettings,
    setAllowedTypes,
    setRequiredCount,
    updateDateConfig,
    updatePersonalConfig,
    setCaptchaEnabled,
    setCaptchaSettings,
} = captchaSlice.actions;
export default captchaSlice.reducer;
