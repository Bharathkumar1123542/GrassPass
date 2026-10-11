import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { challengeCatalog } from '../../src/challenges/catalog';
import { startSession, recordVerdict, completeSession } from '../../src/core/session';
import { validateUpload, validateExif } from '../../src/capture/upload';
import { openWebcam, grabFrame, stopWebcam } from '../../src/capture/webcam';
import { verifySlot } from '../../src/vision/verify-slot';

const challenge = challengeCatalog[0];

const ChallengePage = (): JSX.Element => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [session, setSession] = useState(() => startSession(challenge.id, Date.now()));
  const [message, setMessage] = useState<string>('Capture a photo for each slot.');
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const currentSlot = useMemo(() => challenge.slots[currentSlotIndex], [currentSlotIndex]);

  useEffect(() => {
    return () => {
      stopWebcam(stream);
    };
  });

  const handleCapture = async (): Promise<void> => {
    try {
      const nextStream = await openWebcam();
      setStream(nextStream);
      if (videoRef.current) {
        videoRef.current.srcObject = nextStream;
        await videoRef.current.play();
      }
      setMessage(`Camera ready for ${currentSlot.label}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Camera access failed.');
    }
  };

  const completeSlot = async (file: File): Promise<void> => {
    const uploadValidation = validateUpload(file);
    if (!uploadValidation.valid) {
      setMessage(uploadValidation.message);
      return;
    }

    const exifValidation = await validateExif(uploadValidation.file, Date.now());
    if (!exifValidation.valid) {
      setMessage(exifValidation.message);
      return;
    }

    const result = await verifySlot({
      previousHashes: session.slots.filter((slot) => slot.hash).map((slot) => slot.hash as string),
      imageHash: `${Date.now().toString(16).padStart(16, '0')}`,
      screenQuestion: 'Is this a photo of a computer screen, a phone screen, a TV, or a printed picture?',
      subjectQuestion: currentSlot.subjectQuestion,
      askYesNo: async () => 'yes',
    });

    const nextSession = recordVerdict(session, currentSlot.id, result.passed, result.hash ?? `${Date.now().toString(16).padStart(16, '0')}`);
    setSession(nextSession);

    if (result.passed) {
      setMessage(`${currentSlot.label} passed.`);
      if (currentSlotIndex < challenge.slots.length - 1) {
        setCurrentSlotIndex((index) => index + 1);
      } else {
        const complete = completeSession(nextSession);
        setSession(complete);
        setMessage('All slots passed. Returning to the original URL.');
      }
    } else {
      setMessage(`Photo rejected: ${result.reason}. Try a new image.`);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await completeSlot(file);
    event.target.value = '';
  };

  const handleFrameCapture = async (): Promise<void> => {
    if (!videoRef.current) {
      return;
    }

    const blob = await grabFrame(videoRef.current);
    await completeSlot(new File([blob], 'captured.jpg', { type: 'image/jpeg' }));
  };

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 32, maxWidth: 780 }}>
      <h1>{challenge.title}</h1>
      <p>{challenge.instructions}</p>
      <p>Status: {session.status}</p>
      <p>{message}</p>
      <div>
        <strong>Current slot:</strong> {currentSlot.label}
      </div>
      <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', maxWidth: 420, background: '#ddd', marginTop: 12 }} />
      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <button type="button" onClick={handleCapture}>Open camera</button>
        <button type="button" onClick={handleFrameCapture}>Capture frame</button>
        <label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
          Upload photo
        </label>
      </div>
      <ul>
        {challenge.slots.map((slot, index) => (
          <li key={slot.id} style={{ opacity: index === currentSlotIndex ? 1 : 0.65 }}>
            {slot.label}: {session.slots[index]?.status ?? 'pending'}
          </li>
        ))}
      </ul>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<ChallengePage />);
