using System;
using UnityEngine;

/// <summary>
/// Minimal crash surface: C# throw → IL2CPP/wasm abort, captured by the harness JS SDK.
/// </summary>
public sealed class WasmCrashHarness : MonoBehaviour
{
    [SerializeField] string crashMessage = "Unity WebGL coverage harness crash";

    void OnGUI()
    {
        const int width = 280;
        const int height = 44;
        var rect = new Rect(10f, 10f, width, height);
        if (GUI.Button(rect, "Throw C# exception (Deep3)"))
        {
            TriggerDeepCrash();
        }
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.C))
        {
            TriggerDeepCrash();
        }
    }

    public void TriggerDeepCrash()
    {
        Deep1();
    }

    void Deep1() => Deep2();

    void Deep2() => Deep3();

    void Deep3()
    {
        throw new InvalidOperationException(crashMessage);
    }
}
