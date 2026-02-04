import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type CaptchaType = 'date' | 'number' | 'text' | 'birthdate';

interface CaptchaState {
    allowedTypes: CaptchaType[];
    requiredCount: number;
    dateConfig: {
        todayDate: string;
        birthDate: string;
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
        setCaptchaEnabled: (state, action: PayloadAction<boolean>) => {
            state.enabled = action.payload;
        },
    },
});

export const { setAllowedTypes, setRequiredCount, updateDateConfig, setCaptchaEnabled } = captchaSlice.actions;
export default captchaSlice.reducer;
