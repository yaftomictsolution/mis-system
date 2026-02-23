import { createSlice } from '@reduxjs/toolkit'

export interface UIState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  isMobile: boolean
}

const initialState: UIState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  isMobile: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    setSidebarOpen: (state, action: { payload: boolean }) => {
      state.sidebarOpen = action.payload
    },
    setMobile: (state, action: { payload: boolean }) => {
      state.isMobile = action.payload
      if (action.payload) state.sidebarOpen = false
      else state.sidebarOpen = true
    },
    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
  },
})

export const { toggleSidebar, setSidebarOpen, setMobile, toggleSidebarCollapsed } = uiSlice.actions
export default uiSlice.reducer
