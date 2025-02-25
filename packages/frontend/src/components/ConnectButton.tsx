import './ConnectButton.css';

export default function ConnectButton() {
  return (
    <div className={'connect-button-container'}>
      {/* @ts-expect-error pending update (see https://docs.reown.com/appkit/react/core/installation#trigger-the-modal) */}
      <appkit-button />
    </div>
  );
}
