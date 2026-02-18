import "./App.css";
import cameraGif from './assets/giphy.gif';
import { useEffect, useRef, useState } from "react";
import samplevideo1 from './assets/samplevideo1.mp4';
import samplevideo2 from './assets/samplevideo2.mp4';

function Camera() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [prediction, setPrediction] = useState(null);

  const [violationImageURL, setViolationImageURL] = useState(null);
  const violationActiveRef = useRef(false); 

  const [violationTime, setViolationTime] = useState(0); // time in seconds
  const violationTimerRef = useRef(null);

  const videoRef2 = useRef(null);
  const [secondCamExists, setSecondCamExists] = useState(false);


  useEffect(() => {
  async function startCamera() {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === "videoinput");
      console.log("Detected cams:", cams.map(c => c.label));
      if (cams[0]) {
        const stream1 = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cams[0].deviceId } }
        });
        videoRef.current.srcObject = stream1;
      }
      if (cams[1]) {
        setSecondCamExists(false);
        const stream2 = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cams[1].deviceId } }
        });
        videoRef2.current.srcObject = stream2;
      } else {
        setSecondCamExists(false);
      }

    } catch (err) {
      console.error("Camera error:", err);
    }
  }

  startCamera();
}, []);


  useEffect(() => {
    const interval = setInterval(() => {
      sendFrameToBackend();
      console.log("Frame sent to backend");
    }, 1000);
    return () => clearInterval(interval);//<____________this sends the frame to the backend every 1 second
  }, []);

  useEffect(() => {
    if (violationTime >= 15 && violationImageURL) {
      triggerDownload(violationImageURL);
      URL.revokeObjectURL(violationImageURL);
      setViolationImageURL(null);
      violationActiveRef.current = false;
      clearInterval(violationTimerRef.current);
      violationTimerRef.current = null;
      setViolationTime(0);
    }
  }, [violationTime, violationImageURL]);

  const triggerDownload = (url) => {
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date();
      link.download = `violation_report_${timestamp}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  };

  const canvasToBlob = () => {
    return new Promise((resolve) => {
      canvasRef.current.toBlob((blob) => resolve(blob), "image/jpeg", 0.8);
    });
  };

  const sendFrameToBackend = async () => {
    try {
      captureFrame();
      const blob = await canvasToBlob();
      if (!blob) return;

      const formData = new FormData();
      formData.append("file", blob, "frame.jpg"); 

      const response = await fetch(
        "http://127.0.0.1:8000/analyse",
        {
          method: "POST",
          body: formData,
        }
      );
      // const response = await fetch(
      //   "/analyse", 
      //   {
      //     method: "POST",
      //     body: formData,
      //   }
      // );

      if (!response.ok) {
        throw new Error("Backend error");
      }

      const result = await response.json();
      setPrediction(result);

      const hasViolation =
        result.no_of_helmet_violation > 0 ||
        result.no_of_vest_violation > 0;

      if (hasViolation) {
        if (!violationActiveRef.current) {
          if (violationImageURL) URL.revokeObjectURL(violationImageURL);

          const url = URL.createObjectURL(blob);
          setViolationImageURL(url);
          violationActiveRef.current = true;

          setViolationTime(0);
          violationTimerRef.current = setInterval(() => {
            setViolationTime(prev => prev + 1);
          }, 1000);
        }
      } else {
        if (violationActiveRef.current) {
          if (violationImageURL) URL.revokeObjectURL(violationImageURL);

          setViolationImageURL(null);
          violationActiveRef.current = false;

          clearInterval(violationTimerRef.current);
          violationTimerRef.current = null;
          setViolationTime(0);
        }
      }
    } catch (err) {
      console.error("Prediction failed:", err);
    }
  };


  return (
    <div className="camera-container">
      <div className="camera main">

        <video ref={videoRef} /*src={samplevideo1}*/ autoPlay playsInline muted className="camera-video" />

        <div className="top-rightpanel">
            {violationImageURL && (
                <>
                <img
                src={violationImageURL}
                className="violation-overlay"
                alt="violation"
                />
                <p style={{color:"red"}}>Violation time:{violationTime}s</p>
                </>
            )}
            
            <div className="overlay top-right">
                {prediction ? (
                <>
                    Persons: {prediction.no_of_person}<br /><br/>
                    Helmet Violation: {prediction.no_of_helmet_violation}<br/><br/>
                    Vest Violation: {prediction.no_of_vest_violation}
                </>
                ) : (
                "Waiting for prediction..."
                )}
            </div>
        </div>
        <div className="overlay top-left">Camera 1 • LIVE</div>
      </div>
      <div className="sub-cameras">
        <div>Camera_2</div>
        <div className="camera sub">
            {secondCamExists ? 
            (<video ref={videoRef2} autoPlay playsInline muted className="camera-video"/>)
            :(<img src={cameraGif} alt="camera" />)}
            <div className="overlay top-left">
              Camera 2 • {secondCamExists ? "LIVE" : "N/A"}
            </div>
          </div>

        <div>Camera_3</div>
        <div className="camera sub">
          <img src={cameraGif} alt="camera" />
          <div className="overlay top-left">Camera 3 • N/A</div>
        </div>
        <div>Camera_4</div>
        <div className="camera sub">
          <img src={cameraGif} alt="camera" />
          <div className="overlay top-left">Camera 4 • N/A</div>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

export default Camera;
