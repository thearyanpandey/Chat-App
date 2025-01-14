import { useEffect, useCallback, useState } from "react";
import peer from "../../services/peer";
import ReactPlayer from "react-player";
import { useSocket } from "../context/SocketProvider";

function Stream() {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [connectionStatus, setConnectionStatus] = useState("initializing"); // Add status tracking

  const handleUserJoined = useCallback(
    ({ email, id, roomId, message }) => {
      console.log("Match found event details:", {
        email,
        id,
        roomId,
        message,
        currentSocketId: socket?.id,
      });
      setRemoteSocketId(id);
      setConnectionStatus("connected");
    },
    [socket]
  );

  const handleWaiting = useCallback(({ message }) => {
    console.log("Entered waiting state:", message);
    setConnectionStatus("waiting");
    setRemoteSocketId(null);
  }, []);

  const handlePartnerDisconnected = useCallback(({ message }) => {
    console.log("Partner disconnection event:", message);
    setConnectionStatus("waiting");
    setRemoteSocketId(null);
    setRemoteStream(null);
  }, []);

  const handleCallUser = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      console.log("Got local media stream:", stream.id);
      const offer = await peer.getOffer();
      socket.emit("user:call", { to: remoteSocketId, offer });
      setMyStream(stream);
    } catch (err) {
      console.error("Error getting media stream:", err);
    }
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      try {
        setRemoteSocketId(from);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        setMyStream(stream);
        console.log(`Incoming Call from ${from}`);
        const ans = await peer.getAnswer(offer);
        socket.emit("call:accepted", { to: from, ans });
      } catch (err) {
        console.error("Error handling incoming call:", err);
      }
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    if (!myStream) {
      console.warn("No local stream to send");
      return;
    }
    console.log("Sending streams to peer");
    for (const track of myStream.getTracks()) {
      peer.peer.addTrack(track, myStream);
    }
  }, [myStream]);

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      console.log("Call Accepted!");
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);

  useEffect(() => {
    socket.on("matchFound", handleUserJoined);
    socket.on("waiting", handleWaiting);
    socket.on("partnerDisconnected", handlePartnerDisconnected);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    return () => {
      socket.off("matchFound", handleUserJoined);
      socket.off("waiting", handleWaiting);
      socket.off("partnerDisconnected", handlePartnerDisconnected);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleWaiting,
    handlePartnerDisconnected,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
  ]);

  return (
    <div>
      <h1>Room Page</h1>
      <h4>Status: {connectionStatus}</h4>
      <h4>{remoteSocketId ? "Connected" : "No one in room"}</h4>
      {myStream && <button onClick={sendStreams}>Send Stream</button>}
      {remoteSocketId && <button onClick={handleCallUser}>CALL</button>}
      {myStream && (
        <>
          <h1>My Stream</h1>
          <ReactPlayer
            playing
            muted
            height="100px"
            width="200px"
            url={myStream}
          />
        </>
      )}
      {remoteStream && (
        <>
          <h1>Remote Stream</h1>
          <ReactPlayer
            playing
            muted
            height="100px"
            width="200px"
            url={remoteStream}
          />
        </>
      )}
    </div>
  );
}

export default Stream;
