import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('lucide-react-native', () => ({ ChevronLeft: () => null }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { signInWithPassword: jest.fn() },
  },
}));

import '../lib/i18n';
import { supabase } from '../lib/supabase';
import SignIn from '../../app/sign-in';
import { Button, Choice, Field, Screen } from './ScreenPrimitives';

describe('rendered mobile semantics', () => {
  it('exposes labelled fields, radio state, actions, and navigation', async () => {
    const change = jest.fn();
    const save = jest.fn();
    const view = await render(
      <Screen title="Accessible screen">
        <Field label="Account name" />
        <Choice label="Account class" value="ASSET" options={['ASSET', 'LIABILITY']} onChange={change} />
        <Button label="Save account" onPress={save} />
      </Screen>,
    );

    expect(view.getByRole('header', { name: 'Accessible screen' })).toBeTruthy();
    expect(view.getByLabelText('Account name')).toBeTruthy();
    expect(view.getByRole('radio', { name: 'ASSET' }).props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(view.getByRole('radio', { name: 'LIABILITY' }));
    await fireEvent.press(view.getByRole('button', { name: 'Save account' }));
    await fireEvent.press(view.getByRole('button', { name: 'Go back' }));
    expect(change).toHaveBeenCalledWith('LIABILITY');
    expect(save).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('submits the sign-in form and renders a non-enumerating error', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      error: new Error('provider detail must not be shown'),
    });
    const view = await render(<SignIn />);
    await fireEvent.changeText(view.getByLabelText('Email'), 'person@example.test');
    await fireEvent.changeText(view.getByLabelText('Password'), 'wrong-password');
    await fireEvent.press(view.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'person@example.test',
        password: 'wrong-password',
      }),
    );
    expect(await view.findByText(/incorrect email or password/i)).toBeTruthy();
    expect(view.queryByText(/provider detail/i)).toBeNull();
  });
});
