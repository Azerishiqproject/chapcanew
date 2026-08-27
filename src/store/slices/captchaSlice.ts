import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type CaptchaType =
    | 'date'
    | 'number'
    | 'text'
    | 'birthdate'
    | 'fin'
    | 'religion'
    | 'favoriteCar';

export interface CaptchaState {
    allowedTypes: CaptchaType[];
    requiredCount: number;
    dateConfig: {
        todayDate: string;
        birthDate: string;
    };
    personalConfig: {
        fin: string;
        religion: string;
        favoriteCar: string;
    };
    enabled: boolean;
}

const initialState: CaptchaState = {
    allowedTypes: ['date', 'number', 'text', 'birthdate'],
    requiredCount: 1,
    dateConfig: {
        todayDate: (() => {
            const d = new Date();
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        })(),
        birthDate: '25/08/1990',
    },
    personalConfig: {
        fin: '69SZNKO',
        religion: 'İslam',
        favoriteCar: 'Mercedes',
    },
    enabled: true,
};

const captchaSlice = createSlice({
    name: 'captcha',
    initialState,
    reducers: {
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
});

export const {
    setAllowedTypes,
    setRequiredCount,
    updateDateConfig,
    updatePersonalConfig,
    setCaptchaEnabled,
    setCaptchaSettings,
} = captchaSlice.actions;
export default captchaSlice.reducer;
